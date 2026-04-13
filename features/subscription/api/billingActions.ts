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
}) => {
  return billingService.createCheckoutSession({
    tier: args.tier as "starter" | "pro" | "enterprise",
    successUrl: args.successPath,
    cancelUrl: args.cancelPath,
    billingPeriod: args.billingPeriod,
  });
};

export const cancelRecurrence = async () => {
  return billingService.cancelRecurrence();
};

export const syncSubscription = async () => {
  return billingService.syncSubscription();
};

export const isBillingConfigured = (): boolean => billingService.isBillingConfigured();

export const formatBillingPrice = (
  value: SubscriptionTier | number | null,
  billingCycle: "monthly" | "yearly" = "monthly",
): string => billingService.formatPrice(value, billingCycle);

export { PRICING_CONFIG };
