import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { testConsoleGuard } from './utils/consoleGuard';
import { mapStripeSubscriptionStatusToInternal } from '../supabase/functions/_shared/stripeHelpers';

const mocks = vi.hoisted(() => ({ client: vi.fn(), subscription: vi.fn(), signature: vi.fn() }));
vi.mock('../supabase/functions/_shared/supabase.ts', () => ({ createServiceClient: mocks.client }));
vi.mock('../supabase/functions/_shared/cors.ts', () => ({ handleCors: () => null, buildCorsHeaders: () => ({}) }));
vi.mock('../supabase/functions/_shared/stripeBilling.ts', () => ({
  mapStripeSubscriptionStatusToInternal: (status: string) => mapStripeSubscriptionStatusToInternal(status),
  parseStripeMetadata: (metadata: unknown) => metadata,
  retrieveSubscription: mocks.subscription,
  resolveStripePlanFromPriceId: () => ({ tier: 'pro', billingPeriod: 'monthly' }),
  stripePeriodEndToDate: (seconds: number) => new Date(seconds * 1000),
  validateStripeId: () => true,
  verifyStripeWebhookSignature: mocks.signature,
}));

let handler: (request: Request) => Promise<Response>;
const updates: Record<string, unknown>[] = [];
const previousEnd = '2026-09-10T00:00:00.000Z';
const renewedEnd = '2026-10-10T00:00:00.000Z';

beforeAll(async () => {
  vi.stubGlobal('Deno', { env: { get: () => 'test-webhook-secret' }, serve: (callback: typeof handler) => { handler = callback; } });
  await import('../supabase/functions/stripe-org-webhook/index');
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  updates.length = 0;
  mocks.signature.mockResolvedValue({ valid: true });
  mocks.client.mockImplementation(() => ({ from: (table: string) => {
    const chain = {
      error: null,
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: { id: 'org-test', subscription_tier: 'pro', subscription_status: 'active', expires_at: previousEnd, billing_period_end: '2026-01-01T00:00:00.000Z' }, error: null }),
      insert: async () => ({ error: null }),
      update: (data: Record<string, unknown>) => { if (table === 'organizations') updates.push(data); return chain; },
    };
    return chain;
  } }));
});
const send = async (type: string, status: string) => {
  const subscription = { id: 'sub_test', status, customer: 'cus_test', metadata: { orgId: 'org-test' }, current_period_end: Date.parse(renewedEnd) / 1000, items: { data: [{ price: { id: 'price_test', recurring: { interval: 'month' } }, quantity: 1 }] } };
  mocks.subscription.mockResolvedValue(subscription);
  const object = type.startsWith('invoice.') ? { subscription: 'sub_test', customer: 'cus_test', currency: 'czk' } : subscription;
  return handler(new Request('https://example.test/webhook', { method: 'POST', body: JSON.stringify({ id: 'evt_test', type, data: { object } }) }));
};

describe('Stripe organization webhook access deadlines', () => {
  it('persists matching deadlines after successful renewal', async () => {
    const response = await send('customer.subscription.updated', 'active');
    expect(response.status).toBe(200);
    expect(updates).toEqual([expect.objectContaining({ subscription_status: 'active', expires_at: renewedEnd, billing_period_end: renewedEnd })]);
  });
  it.each(['customer.subscription.updated', 'invoice.payment_failed'])('retains the original paid period for a past_due %s', async (type) => {
    expect((await send(type, 'past_due')).status).toBe(200);
    expect(updates).toEqual([expect.objectContaining({ subscription_status: 'pending', expires_at: previousEnd, billing_period_end: previousEnd })]);
  });
  it.each(['customer.subscription.updated', 'invoice.payment_failed'])('does not grant a paid period for an incomplete %s', async (type) => {
    expect((await send(type, 'incomplete')).status).toBe(200);
    expect(updates).toEqual([expect.objectContaining({ subscription_status: 'pending', expires_at: null, billing_period_end: null })]);
  });
  it('rejects an invalid signature before changing subscription data', async () => {
    testConsoleGuard.expect('warn', 'Stripe org webhook signature invalid: invalid');
    mocks.signature.mockResolvedValue({ valid: false, reason: 'invalid' });
    expect((await send('customer.subscription.updated', 'active')).status).toBe(401);
    expect(updates).toEqual([]);
  });
});
