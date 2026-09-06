import { buildCorsHeaders } from './cors.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

/** Check with the caller's JWT, before using privileged clients or external providers. */
export const requireActiveSubscription = async (req: Request): Promise<Response | null> => {
  if (req.method === 'OPTIONS') return null;
  const response = (status: number, error: string) => new Response(JSON.stringify({ error }), {
    status, headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
  });
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return response(401, 'unauthorized');
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return response(503, 'subscription_verification_unavailable');
  try {
    const result = await fetch(`${url}/rest/v1/rpc/has_active_subscription`, {
      method: 'POST',
      headers: { Authorization: authorization, apikey: anonKey, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(10_000),
    });
    if (result.status === 401) return response(401, 'unauthorized');
    if (!result.ok) return response(503, 'subscription_verification_unavailable');
    return await result.json() === true ? null : response(402, 'subscription_required');
  } catch {
    return response(503, 'subscription_verification_unavailable');
  }
};
