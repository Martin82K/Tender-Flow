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
    tier: args.tier,
    successUrl: args.successPath,
    cancelUrl: args.cancelPath,
    billingPeriod: args.billingPeriod,
  });
};

export const createBillingPortalSession = async (returnPath: string) => {
  return billingService.createBillingPortalSession({ returnUrl: returnPath });
};

export const syncSubscription = async () => {
  return billingService.syncSubscription();
};

export const isBillingConfigured = (): boolean => billingService.isBillingConfigured();

export const formatBillingPrice = (
  tier: SubscriptionTier,
  billingCycle: "monthly" | "yearly",
): string => billingService.formatPrice(tier, billingCycle);

export { PRICING_CONFIG };
