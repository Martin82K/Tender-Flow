/**
 * Payment Provider Service — Stripe-only billing edge-function facade.
 *
 * Modul drží jen mapování klientských billing akcí na Stripe edge funkce a
 * sjednocuje checkout response shape pro existující konzumenty.
 */

import { invokeAuthedFunction } from './functionsClient';

const FUNCTION_NAMES = {
  createPayment: 'stripe-create-payment',
  cancelSubscription: 'stripe-cancel-subscription',
  syncSubscription: 'stripe-sync-subscription',
  createOrgPayment: 'stripe-create-org-payment',
  cancelOrgSubscription: 'stripe-cancel-org-subscription',
  syncOrgSubscription: 'stripe-sync-org-subscription',
} as const;

type ProviderAction = keyof typeof FUNCTION_NAMES;

export type BillingProvider = 'stripe';

export const getActiveBillingProvider = (): BillingProvider => 'stripe';

const fnFor = (action: ProviderAction): string => FUNCTION_NAMES[action];

// ---------- Shared types ----------

export type CheckoutTier = 'starter' | 'pro' | 'enterprise';
export type CheckoutBillingPeriod = 'monthly' | 'yearly';

export interface UserCheckoutRequest {
  tier: CheckoutTier;
  billingPeriod?: CheckoutBillingPeriod;
  successUrl: string;
  cancelUrl: string;
}

export interface OrgCheckoutRequest {
  orgId: string;
  tier: CheckoutTier;
  billingPeriod: CheckoutBillingPeriod;
  seats: number;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResponse {
  success: boolean;
  paymentUrl?: string;
  checkoutUrl?: string;
  paymentId?: string;
  error?: string;
}

export interface CancelResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface SyncedSubscription {
  id: string;
  tier: string;
  status: string;
  expiresAt: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface SyncSubscriptionResponse {
  success: boolean;
  message?: string;
  subscription?: SyncedSubscription | null;
  error?: string;
}

// Stripe edge funkce vracejí `sessionId`; upstream zachovává historický `paymentId`.
type RawCheckoutResponse = CheckoutResponse & { sessionId?: string };

const normalizeCheckoutResponse = (raw: RawCheckoutResponse): CheckoutResponse => {
  const checkoutUrl = raw.checkoutUrl ?? raw.paymentUrl;
  return {
    success: raw.success,
    paymentUrl: raw.paymentUrl ?? checkoutUrl,
    checkoutUrl,
    paymentId: raw.paymentId ?? raw.sessionId,
    error: raw.error,
  };
};

// ---------- Public API ----------

export const paymentProviderService = {
  getActiveProvider: getActiveBillingProvider,

  /** Vytvoří user-level checkout session (uživatelské předplatné). */
  createUserCheckoutSession: async (
    request: UserCheckoutRequest,
  ): Promise<CheckoutResponse> => {
    const raw = await invokeAuthedFunction<RawCheckoutResponse>(
      fnFor('createPayment'),
      { body: request },
    );
    return normalizeCheckoutResponse(raw);
  },

  /** Zruší user-level recurring (cancel_at_period_end). */
  cancelUserSubscription: (): Promise<CancelResponse> =>
    invokeAuthedFunction<CancelResponse>(fnFor('cancelSubscription'), { body: {} }),

  /** Force sync user-level předplatného z bránové strany. */
  syncUserSubscription: (): Promise<SyncSubscriptionResponse> =>
    invokeAuthedFunction<SyncSubscriptionResponse>(fnFor('syncSubscription'), { body: {} }),

  /** Vytvoří org-level checkout session (per-seat předplatné). */
  createOrgCheckoutSession: async (
    request: OrgCheckoutRequest,
  ): Promise<CheckoutResponse> => {
    const raw = await invokeAuthedFunction<RawCheckoutResponse>(
      fnFor('createOrgPayment'),
      { body: request },
    );
    return normalizeCheckoutResponse(raw);
  },

  /** Zruší org-level recurring (owner-only RBAC enforced server-side). */
  cancelOrgSubscription: (orgId: string): Promise<CancelResponse> =>
    invokeAuthedFunction<CancelResponse>(fnFor('cancelOrgSubscription'), {
      body: { orgId },
    }),

  /** Force sync org-level předplatného. */
  syncOrgSubscription: (orgId: string): Promise<SyncSubscriptionResponse> =>
    invokeAuthedFunction<SyncSubscriptionResponse>(fnFor('syncOrgSubscription'), {
      body: { orgId },
    }),
};
