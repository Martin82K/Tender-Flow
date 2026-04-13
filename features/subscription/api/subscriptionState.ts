import { subscriptionFeaturesService } from "@/services/subscriptionFeaturesService";
import { userSubscriptionService } from "@/services/userSubscriptionService";
import type { FeatureAccessSnapshot, SubscriptionSnapshot } from "../model/types";
import type { EffectiveTierResult } from "@/features/organization/model/types";
import { orgSubscriptionRpc } from "@/infra/org-billing/orgSubscriptionRpc";

export const getSubscriptionState = async (): Promise<SubscriptionSnapshot> => {
  const state = await userSubscriptionService.getSubscriptionStatus();
  return {
    ...state,
    refreshedAt: new Date().toISOString(),
  };
};

export const getFeatureAccess = async (
  featureKey: string,
): Promise<FeatureAccessSnapshot> => {
  const access = await subscriptionFeaturesService.checkFeatureAccess(featureKey);
  return {
    feature: access.feature,
    tier: access.tier,
    hasAccess: access.hasAccess,
  };
};

export const getCurrentTier = async (): Promise<string> => {
  return subscriptionFeaturesService.getUserSubscriptionTier();
};

export const getEnabledFeatures = async (): Promise<
  { key: string; name: string; description: string | null; category: string | null }[]
> => {
  return subscriptionFeaturesService.getUserEnabledFeatures();
};

export const formatSubscriptionExpirationDate = (expiresAt: string | null): string =>
  userSubscriptionService.formatExpirationDate(expiresAt);

/**
 * Get effective user tier (org-level with override support).
 * Priority: org override → org subscription → user legacy → free.
 */
export const getEffectiveUserTier = async (): Promise<EffectiveTierResult> => {
  return orgSubscriptionRpc.getEffectiveUserTier();
};

/**
 * Get enabled features using the v2 RPC (org-aware + per-user overrides).
 */
export const getEnabledFeaturesV2 = async (): Promise<
  { key: string; name: string; description: string | null; category: string | null }[]
> => {
  return orgSubscriptionRpc.getEnabledFeaturesV2();
};
