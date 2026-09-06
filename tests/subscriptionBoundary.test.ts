import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireActiveSubscription } from '../supabase/functions/_shared/subscriptionAccess';

const request = () => new Request('https://example.supabase.co/functions/v1/excel-merge', {
  method: 'POST', headers: { Authorization: 'Bearer user-token', Origin: 'https://tenderflow.cz' },
});
afterEach(() => vi.unstubAllGlobals());
const setup = () => {
  vi.stubGlobal('Deno', { env: { get: (key: string) => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public-key' })[key] } });
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
};
describe('Edge subscription boundary', () => {
  it('denies unpaid users before calling any business operation', async () => {
    const fetcher = setup().mockResolvedValue(new Response('false'));
    const response = await requireActiveSubscription(request());
    expect(response?.status).toBe(402);
    expect(await response?.json()).toEqual({ error: 'subscription_required' });
    expect(response?.headers.get('access-control-allow-origin')).toBe('https://tenderflow.cz');
    expect(fetcher).toHaveBeenCalledWith('https://example.supabase.co/rest/v1/rpc/has_active_subscription', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer user-token', apikey: 'public-key' }) }));
  });
  it('continues only for a verified boolean true', async () => {
    const fetcher = setup().mockResolvedValue(new Response('true'));
    expect(await requireActiveSubscription(request())).toBeNull();
    fetcher.mockResolvedValue(new Response('"true"'));
    expect((await requireActiveSubscription(request()))?.status).toBe(402);
  });
  it('fails closed on verification failures without exposing upstream errors', async () => {
    setup().mockRejectedValue(new Error('private backend details'));
    const response = await requireActiveSubscription(request());
    expect(response?.status).toBe(503);
    expect(await response?.text()).not.toContain('private backend details');
  });
  it('preserves preflight without authentication and rejects missing credentials', async () => {
    const fetcher = setup();
    expect(await requireActiveSubscription(new Request('https://example.test', { method: 'OPTIONS' }))).toBeNull();
    expect((await requireActiveSubscription(new Request('https://example.test')))?.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
