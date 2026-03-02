import { billingService, PRICING_CONFIG } from "@/services/billingService";
import { userSubscriptionService } from "@/services/userSubscriptionService";
import type { SubscriptionTier } from "@/types";

export const requestPlanChange = async (tier: SubscriptionTier) => {
  return userSubscriptionService.requestTierUpgrade(tier);
};

export const cancelPlan = async () => {
  return userSubscriptionService.cancelSubscription();
};

export const reactivatePlan = async () => {
  return userSubscriptionService.reactivateSubscription();
};

export const createCheckoutSession = async (args: {
  tier: SubscriptionTier;
  successPath: string;
  cancelPath: string;
  billingPeriod?: "monthly" | "yearly";
  paymentMethodPreference?: "auto" | "wallet_first";
}) => {
  return billingService.createCheckoutSession({
    tier: args.tier as "starter" | "pro" | "enterprise",
    successUrl: args.successPath,
    cancelUrl: args.cancelPath,
    billingPeriod: args.billingPeriod,
    paymentMethodPreference: args.paymentMethodPreference ?? "auto",
  });
};

export const createBillingPortalSession = async (returnPath: string) => {
  return billingService.createBillingPortalSession({ returnUrl: returnPath });
};

export const syncSubscription = async () => {
  return billingService.syncSubscription();
};

export const createSetupIntent = async () => {
  return billingService.createSetupIntent();
};

export const createSubscriptionFromPaymentMethod = async (args: {
  tier: SubscriptionTier;
  billingPeriod?: "monthly" | "yearly";
  paymentMethodId: string;
  idempotencyKey?: string;
}) => {
  const fallbackIdempotencyKey =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return billingService.createSubscriptionFromPaymentMethod({
    tier: args.tier as "starter" | "pro" | "enterprise",
    billingPeriod: args.billingPeriod,
    paymentMethodId: args.paymentMethodId,
    idempotencyKey: args.idempotencyKey || fallbackIdempotencyKey,
  });
};

export const isBillingConfigured = (): boolean => billingService.isBillingConfigured();

export const formatBillingPrice = (
  value: SubscriptionTier | number | null,
  billingCycle: "monthly" | "yearly" = "monthly",
): string => billingService.formatPrice(value, billingCycle);

export { PRICING_CONFIG };
