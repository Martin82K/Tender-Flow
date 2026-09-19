import { Buffer } from 'node:buffer';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const secret = Deno.env.get('SEND_EMAIL_HOOK_SECRET');
const apiKey = Deno.env.get('RESEND_API_KEY');
const sender = Deno.env.get('DEFAULT_EMAIL_FROM') || 'Tender Flow <noreply@tenderflow.cz>';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const redirectTo = 'https://www.tenderflow.cz';
const reply = (status: number, message?: string) => Response.json(
  message ? { error: { http_code: status, message } } : {}, { status },
);
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

// Standard Webhooks signs the exact raw request bytes, ID and timestamp.
function verified(body: string, headers: Headers): boolean {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  if (!secret || !id || id.length > 256 || !timestamp || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = Buffer.from(secret.replace(/^v1,whsec_/, '').replace(/^whsec_/, ''), 'base64');
  if (key.length < 32) return false;
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();
  return (headers.get('webhook-signature') || '').split(' ').some(signature => {
    const [version, encoded] = signature.split(',');
    if (version !== 'v1' || !encoded) return false;
    const actual = Buffer.from(encoded, 'base64');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

// Only signup may carry an application deep link. Never trust arbitrary
// redirect URLs from the signed payload: the caller originally supplies them.
function signupRedirect(value: unknown): string {
  try {
    const target = new URL(text(value));
    if (target.origin === redirectTo && !target.username && !target.password
      && (target.pathname === '/app' || target.pathname.startsWith('/app/'))) {
      target.hash = '';
      return target.href;
    }
  } catch { /* Fall back to the trusted site root. */ }
  return redirectTo;
}

interface Mail { to: string; subject: string; text: string }
function messages(payload: unknown): Mail[] {
  const root = record(payload);
  const user = record(root.user);
  const data = record(root.email_data);
  const action = text(data.email_action_type);
  const subjects: Record<string, string> = {
    signup: 'Potvrďte svůj e-mail pro Tender Flow',
    invite: 'Pozvánka do Tender Flow',
    recovery: 'Obnovení hesla Tender Flow',
    magiclink: 'Přihlášení do Tender Flow',
    email_change: 'Potvrzení změny e-mailu Tender Flow',
    reauthentication: 'Ověřovací kód Tender Flow',
  };
  if (!Object.hasOwn(subjects, action)) throw new Error('Invalid action');
  const make = (email: unknown, hash: unknown): Mail => {
    const to = text(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 320) throw new Error('Invalid recipient');
    if (action === 'reauthentication') {
      const code = text(data.token);
      if (!/^\d{6,10}$/.test(code)) throw new Error('Invalid code');
      return { to, subject: subjects[action], text: `Váš ověřovací kód pro Tender Flow: ${code}\nPokud jste o něj nežádali, zprávu ignorujte.` };
    }
    const tokenHash = text(hash);
    if (!tokenHash || tokenHash.length > 512 || !/^[a-zA-Z0-9_-]+$/.test(tokenHash)) throw new Error('Invalid token');
    const link = action === 'recovery'
      ? new URL('/reset-password', redirectTo)
      : new URL('/auth/v1/verify', supabaseUrl);
    if (link.protocol !== 'https:') throw new Error('Invalid Auth URL');
    if (action === 'recovery') {
      link.searchParams.set('auth_token_hash', tokenHash);
    } else {
      link.searchParams.set('token', tokenHash);
      link.searchParams.set('type', action);
      link.searchParams.set('redirect_to', action === 'signup' ? signupRedirect(data.redirect_to) : redirectTo);
    }
    return { to, subject: subjects[action], text: `${subjects[action]}:\n\n${link}\n\nPokud jste o tuto akci nežádali, zprávu ignorujte.` };
  };
  if (action === 'email_change') {
    // Supabase's *_new hash belongs to the CURRENT address (historical naming).
    const mails: Mail[] = [];
    if (text(data.token_hash_new)) mails.push(make(user.email, data.token_hash_new));
    mails.push(make(user.new_email, data.token_hash));
    return mails;
  }
  return [make(user.email, data.token_hash)];
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return reply(405, 'Method not allowed');
  if (!secret || !apiKey || !supabaseUrl) return reply(503, 'Email service unavailable');
  const body = await req.text();
  if (body.length > 65536) return reply(413, 'Payload too large');
  if (!verified(body, req.headers)) return reply(401, 'Invalid webhook signature');
  let mails: Mail[];
  try { mails = messages(JSON.parse(body)); } catch { return reply(400, 'Invalid email request'); }
  const eventHash = createHash('sha256').update(req.headers.get('webhook-id')!).digest('hex');
  try {
    const delivered = await Promise.all(mails.map(async (mail, index) => {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `auth-mail-${eventHash}-${index}` },
        body: JSON.stringify({ from: sender, to: [mail.to], subject: mail.subject, text: mail.text }),
        signal: AbortSignal.timeout(4000),
      });
      const ok = response.ok;
      await response.body?.cancel();
      return ok;
    }));
    return delivered.every(Boolean) ? reply(200) : reply(503, 'Email delivery unavailable');
  } catch { return reply(503, 'Email delivery unavailable'); }
});
