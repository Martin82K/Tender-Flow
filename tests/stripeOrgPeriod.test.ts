import { describe, expect, it } from 'vitest';
import { stripeOrgPeriodUpdate } from '../supabase/functions/_shared/stripeOrgPeriod';

const previousEnd = '2026-09-10T00:00:00.000Z';
const renewedEnd = new Date('2026-10-10T00:00:00.000Z');
const input = { stripeStatus: 'active', newExpiresAt: renewedEnd, existingExpiresAt: previousEnd };

describe('organization subscription period from Stripe', () => {
  it('replaces both manual and legacy deadlines on successful renewal', () => {
    expect(stripeOrgPeriodUpdate(input)).toEqual({ expires_at: renewedEnd.toISOString(), billing_period_end: renewedEnd.toISOString() });
  });
  it('retains only the previously granted period during payment retries', () => {
    expect(stripeOrgPeriodUpdate({ ...input, stripeStatus: 'past_due' })).toEqual({ expires_at: previousEnd, billing_period_end: previousEnd });
  });
  it('does not create a grace period for an organization with no prior entitlement', () => {
    expect(stripeOrgPeriodUpdate({ ...input, stripeStatus: 'past_due', existingExpiresAt: null })).toEqual({ expires_at: null, billing_period_end: null });
  });
  it('does not grant access for an incomplete first payment, even when an invoice fails', () => {
    expect(stripeOrgPeriodUpdate({ ...input, stripeStatus: 'incomplete', keepExistingExpires: true })).toEqual({ expires_at: null, billing_period_end: null });
  });
  it('preserves the stored deadline for a failed invoice received while Stripe still reports active', () => {
    expect(stripeOrgPeriodUpdate({ ...input, keepExistingExpires: true })).toEqual({ expires_at: previousEnd, billing_period_end: previousEnd });
  });
  it('clears the deadline when the subscription expires', () => {
    expect(stripeOrgPeriodUpdate({ ...input, stripeStatus: 'unpaid', newExpiresAt: null })).toEqual({ expires_at: null, billing_period_end: null });
  });
});
