/**
 * Organization Billing Actions
 *
 * Actions for org-level GoPay checkout, cancellation, and sync.
 * Calls org-specific Edge Functions.
 */

import { invokeAuthedFunction } from '@/services/functionsClient';
import type { SubscriptionTierId } from '@/config/subscriptionTiers';
import { PRICING_CONFIG } from '@/services/billingService';

interface OrgCheckoutResponse {
  success: boolean;
  checkoutUrl?: string;
  paymentUrl?: string;
  paymentId?: string;
  error?: string;
}

/**
 * Create a GoPay payment for an organization subscription.
 */
export const createOrgCheckout = async (args: {
  orgId: string;
  tier: 'starter' | 'pro' | 'enterprise';
  billingPeriod: 'monthly' | 'yearly';
  seats: number;
  successPath: string;
  cancelPath: string;
}): Promise<OrgCheckoutResponse> => {
  const result = await invokeAuthedFunction<OrgCheckoutResponse>(
    'gopay-create-org-payment',
    {
      body: {
        orgId: args.orgId,
        tier: args.tier,
        billingPeriod: args.billingPeriod,
        seats: args.seats,
        successUrl: args.successPath,
        cancelUrl: args.cancelPath,
      },
    },
  );
  return result;
};

/**
 * Cancel org recurring subscription.
 */
export const cancelOrgSubscription = async (orgId: string): Promise<{ success: boolean; error?: string }> => {
  return invokeAuthedFunction('gopay-cancel-org-subscription', {
    body: { orgId },
  });
};

/**
 * Force-sync org subscription from GoPay.
 */
export const syncOrgSubscription = async (orgId: string): Promise<{ success: boolean; error?: string }> => {
  return invokeAuthedFunction('gopay-sync-org-subscription', {
    body: { orgId },
  });
};

/**
 * Calculate price for a given tier, billing period, and seat count.
 * Returns amount in CZK (integer, halíře).
 */
export const calculateOrgPrice = (
  tier: 'starter' | 'pro',
  billingPeriod: 'monthly' | 'yearly',
  seats: number,
): number => {
  const config = PRICING_CONFIG[tier];
  if (!config) return 0;
  const pricePerSeat = billingPeriod === 'yearly'
    ? Math.round((config.yearlyPrice || 0) / 12)
    : config.monthlyPrice || 0;
  return pricePerSeat * seats;
};

/**
 * Format price for display (halíře → Kč string).
 */
export const formatOrgPrice = (amountHalere: number): string => {
  const kc = Math.round(amountHalere / 100);
  return `${kc.toLocaleString('cs-CZ')} Kč`;
};

export { PRICING_CONFIG };
