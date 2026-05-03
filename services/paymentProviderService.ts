/**
 * Payment Provider Service — globální router mezi GoPay a Stripe.
 *
 * Provider se vybírá z env varu `VITE_BILLING_PROVIDER` (`gopay` | `stripe`),
 * default = `gopay`. Žádný per-user/per-org switch.
 *
 * Tento modul je tenká abstrakce: rozhoduje pouze o tom, kterou edge funkci
 * zavolat a normalizuje response shape (Stripe používá `sessionId`, GoPay
 * `paymentId` — upstream kód vidí vždy `paymentId`).
 *
 * Nepřidává žádnou další logiku (žádné error mapování, žádné UI strings).
 * Konzumenti (`billingService.ts`, `features/organization/api/orgBillingActions.ts`)
 * si zachovávají vlastní user-friendly error mapping.
 */

import { invokeAuthedFunction } from './functionsClient';

export type BillingProvider = 'gopay' | 'stripe';

const SUPPORTED_PROVIDERS: readonly BillingProvider[] = ['gopay', 'stripe'];
const DEFAULT_PROVIDER: BillingProvider = 'gopay';

const FUNCTION_NAMES = {
  gopay: {
    createPayment: 'gopay-create-payment',
    cancelSubscription: 'gopay-cancel-subscription',
    syncSubscription: 'gopay-sync-subscription',
    createOrgPayment: 'gopay-create-org-payment',
    cancelOrgSubscription: 'gopay-cancel-org-subscription',
    syncOrgSubscription: 'gopay-sync-org-subscription',
  },
  stripe: {
    createPayment: 'stripe-create-payment',
    cancelSubscription: 'stripe-cancel-subscription',
    syncSubscription: 'stripe-sync-subscription',
    createOrgPayment: 'stripe-create-org-payment',
    cancelOrgSubscription: 'stripe-cancel-org-subscription',
    syncOrgSubscription: 'stripe-sync-org-subscription',
  },
} as const;

type ProviderAction = keyof typeof FUNCTION_NAMES['gopay'];

export const getActiveBillingProvider = (): BillingProvider => {
  const raw = (import.meta.env.VITE_BILLING_PROVIDER || '').toString().trim().toLowerCase();
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(raw)
    ? (raw as BillingProvider)
    : DEFAULT_PROVIDER;
};

const fnFor = (action: ProviderAction): string =>
  FUNCTION_NAMES[getActiveBillingProvider()][action];

// ---------- Shared types (response shape unified across providers) ----------

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

// Stripe edge funkce vracejí `sessionId`; GoPay vrací `paymentId`. Sjednotíme upstream.
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
