const RETIRED_SECURE_STORAGE_KEYS = [
  "bid_comparison_agent_secret_v1",
  "bidComparison:autoConfigs:v1",
  "bidComparisonAgentSettings:v1",
] as const;

interface SecureStorageCleanupTarget {
  deleteMany(keys: readonly string[]): Promise<void>;
}

export const cleanupRetiredDesktopFeatureStorage = async (
  storage: SecureStorageCleanupTarget,
): Promise<void> => {
  await storage.deleteMany(RETIRED_SECURE_STORAGE_KEYS);
};
