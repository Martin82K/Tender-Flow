import { trackFeatureUsage as trackLegacyFeatureUsage } from "@/services/featureUsageService";

export const trackFeatureUsage = (
  featureKey: string,
  metadata: Record<string, unknown> = {},
): Promise<boolean> => trackLegacyFeatureUsage(featureKey, metadata);
