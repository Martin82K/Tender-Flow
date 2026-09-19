// @vitest-environment node
import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const secret = Buffer.alloc(32, 17).toString('base64');
const fetchMock = vi.fn();
let handler: (request: Request) => Promise<Response>;
const payload = { user: { email: 'delivered@resend.dev' }, email_data: { email_action_type: 'signup', token_hash: 'abc123', redirect_to: 'https://evil.invalid', token: '123456' } };
const signed = (value: unknown = payload, age = 0, signatureSecret = secret) => {
  const body = JSON.stringify(value);
  const timestamp = String(Math.floor(Date.now() / 1000) + age);
  const id = 'test-event-1';
  const signature = createHmac('sha256', Buffer.from(signatureSecret, 'base64')).update(`${id}.${timestamp}.${body}`).digest('base64');
  return new Request('https://example.invalid/hook', { method: 'POST', body, headers: { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` } });
};
beforeAll(async () => {
  vi.stubGlobal('Deno', { env: { get: (key: string) => ({ SEND_EMAIL_HOOK_SECRET: `v1,whsec_${secret}`, RESEND_API_KEY: 'test-key', DEFAULT_EMAIL_FROM: 'Tender Flow <noreply@tenderflow.cz>', SUPABASE_URL: 'https://project.supabase.co' }[key]) }, serve: (callback: typeof handler) => { handler = callback; } });
  vi.stubGlobal('fetch', fetchMock);
  await import('../supabase/functions/auth-send-email/index');
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => { fetchMock.mockReset(); fetchMock.mockResolvedValue(new Response('{"id":"fixture"}', { status: 200 })); });

describe('signed Auth mail through Resend', () => {
  it.each([-301, 301])('rejects timestamps outside the replay window (%s)', async age => {
    expect((await handler(signed(payload, age))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects forged signatures before sending any mail', async () => {
    expect((await handler(signed(payload, 0, Buffer.alloc(32, 18).toString('base64')))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects an unsigned request', async () => {
    expect((await handler(new Request('https://example.invalid', { method: 'POST', body: JSON.stringify(payload) }))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('sends confirmation to the signed recipient with a fixed trusted redirect and idempotency key', async () => {
    expect((await handler(signed())).status).toBe(200);
    const [url, options] = fetchMock.mock.calls[0];
    const mail = JSON.parse(options.body);
    expect(url).toBe('https://api.resend.com/emails');
    expect(mail.to).toEqual(['delivered@resend.dev']);
    expect(mail.text).toContain('https://project.supabase.co/auth/v1/verify?token=abc123&type=signup');
    expect(mail.text).toContain('redirect_to=https%3A%2F%2Fwww.tenderflow.cz');
    expect(mail.text).not.toContain('evil.invalid');
    expect(options.headers['Idempotency-Key']).toMatch(/^auth-mail-[a-f0-9]+-0$/);
  });
  it('maps secure email change hashes to the correct old and new recipients', async () => {
    expect((await handler(signed({ user: { email: 'old@example.invalid', new_email: 'new@example.invalid' }, email_data: { email_action_type: 'email_change', token_hash: 'for-new', token_hash_new: 'for-old' } }))).status).toBe(200);
    const sent = fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body));
    expect(sent).toHaveLength(2);
    expect(sent[0].to).toEqual(['old@example.invalid']);
    expect(sent[0].text).toContain('token=for-old');
    expect(sent[1].to).toEqual(['new@example.invalid']);
    expect(sent[1].text).toContain('token=for-new');
  });
  it.each(['invite', 'magiclink'])('preserves %s mail flows', async action => {
    expect((await handler(signed({ ...payload, email_data: { ...payload.email_data, email_action_type: action } }))).status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toContain(`type=${action}`);
  });
  it('routes recovery tokens to a working reset form without granting a session first', async () => {
    expect((await handler(signed({ ...payload, email_data: { ...payload.email_data, email_action_type: 'recovery' } }))).status).toBe(200);
    const mail = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(mail.text).toContain('https://www.tenderflow.cz/reset-password?auth_token_hash=abc123');
    expect(mail.text).not.toContain('/auth/v1/verify');
  });
  it('returns a retryable failure without exposing provider payloads or tokens', async () => {
    fetchMock.mockResolvedValue(new Response('secret provider diagnostic', { status: 503 }));
    const response = await handler(signed());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('secret');
  });
  it('rejects invalid payloads without sending mail', async () => {
    expect((await handler(signed({ user: {}, email_data: {} }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
