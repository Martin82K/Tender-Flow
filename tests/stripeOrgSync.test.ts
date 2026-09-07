import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapStripeSubscriptionStatusToInternal } from '../supabase/functions/_shared/stripeHelpers';

const mocks = vi.hoisted(() => ({ service: vi.fn(), user: vi.fn(), subscription: vi.fn(), list: vi.fn() }));
vi.mock('../supabase/functions/_shared/supabase.ts', () => ({ createServiceClient: mocks.service, createAuthedUserClient: mocks.user }));
vi.mock('../supabase/functions/_shared/cors.ts', () => ({ handleCors: () => null, buildCorsHeaders: () => ({}) }));
vi.mock('../supabase/functions/_shared/stripeBilling.ts', () => ({
  mapStripeSubscriptionStatusToInternal: (status: string) => mapStripeSubscriptionStatusToInternal(status),
  parseStripeMetadata: (metadata: unknown) => metadata,
  retrieveSubscription: mocks.subscription,
  stripeFetch: mocks.list,
  stripePeriodEndToDate: (seconds: number) => new Date(seconds * 1000),
  validateStripeId: () => true,
}));
let handler: (request: Request) => Promise<Response>;
const updates: Record<string, unknown>[] = [];
const previousEnd = '2026-09-01T00:00:00.000Z';
const renewedEnd = '2026-10-10T00:00:00.000Z';
let storedEnd: string | null = previousEnd;
beforeAll(async () => {
  vi.stubGlobal('Deno', { serve: (callback: typeof handler) => { handler = callback; } });
  await import('../supabase/functions/stripe-sync-org-subscription/index');
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  updates.length = 0;
  storedEnd = previousEnd;
  mocks.user.mockReturnValue({ auth: { getUser: async () => ({ data: { user: { id: 'user-test' } }, error: null }) } });
  mocks.list.mockResolvedValue({ data: [{ id: 'sub_test', status: 'active' }] });
  mocks.service.mockImplementation(() => ({ from: (table: string) => {
    let columns = '';
    const chain = {
      error: null,
      select: (value: string) => { columns = value; return chain; },
      eq: () => chain,
      maybeSingle: async () => ({ data: table === 'organization_members' ? { role: 'member' } : {
        billing_customer_id: 'cus_test', subscription_tier: 'pro', max_seats: 2, billing_period: 'monthly',
        ...(columns.includes('expires_at') ? { expires_at: storedEnd } : {}),
      }, error: null }),
      insert: async () => ({ error: null }),
      update: (data: Record<string, unknown>) => { updates.push(data); return chain; },
    };
    return chain;
  } }));
});
const send = async (status: string) => {
  mocks.subscription.mockResolvedValue({ id: 'sub_test', status, customer: 'cus_test', metadata: {},
    current_period_end: Date.parse(renewedEnd) / 1000, items: { data: [] } });
  return handler(new Request('https://example.test/sync', { method: 'POST', body: JSON.stringify({ orgId: 'org-test' }) }));
};
describe('organization subscription synchronization', () => {
  it.each([['active', renewedEnd], ['trialing', renewedEnd], ['past_due', previousEnd], ['incomplete', null], ['unpaid', null]])(
    'uses the paid access deadline for %s in storage and response', async (status, expected) => {
      const response = await send(status!);
      expect(response.status).toBe(200);
      expect(updates).toEqual([expect.objectContaining({ expires_at: expected, billing_period_end: expected })]);
      expect((await response.json()).subscription.expiresAt).toBe(expected);
    },
  );
  it('does not create a grace period when none was previously granted', async () => {
    storedEnd = null;
    expect((await send('past_due')).status).toBe(200);
    expect(updates[0]).toMatchObject({ expires_at: null, billing_period_end: null });
  });
  it('rejects missing authentication before reading or changing billing', async () => {
    mocks.service.mockClear();
    mocks.user.mockReturnValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } });
    expect((await send('active')).status).toBe(401);
    expect(mocks.service).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });
});
