const RETIRED_SECURE_STORAGE_KEYS = [
  "bid_comparison_agent_secret_v1",
  "bidComparison:autoConfigs:v1",
] as const;

interface SecureStorageCleanupTarget {
  delete(key: string): Promise<void>;
}

export const cleanupRetiredDesktopFeatureStorage = async (
  storage: SecureStorageCleanupTarget,
): Promise<void> => {
  await Promise.all(
    RETIRED_SECURE_STORAGE_KEYS.map((key) => storage.delete(key)),
  );
};
