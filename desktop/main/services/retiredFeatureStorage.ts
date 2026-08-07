const RETIRED_SECURE_STORAGE_KEYS = [
  "bid_comparison_agent_secret_v1",
  "bidComparison:autoConfigs:v1",
  "bidComparisonAgentSettings:v1",
] as const;

interface SecureStorageCleanupTarget {
  delete(key: string): Promise<void>;
}

export const cleanupRetiredDesktopFeatureStorage = async (
  storage: SecureStorageCleanupTarget,
): Promise<void> => {
  const errors: unknown[] = [];

  for (const key of RETIRED_SECURE_STORAGE_KEYS) {
    try {
      await storage.delete(key);
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    throw errors[0];
  }
};
