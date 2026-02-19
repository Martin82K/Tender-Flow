import type { SubscriptionInfo } from "@/types";

export interface SubscriptionSnapshot extends SubscriptionInfo {
  refreshedAt: string;
}

export interface FeatureAccessSnapshot {
  feature: string;
  tier: string;
  hasAccess: boolean;
}
