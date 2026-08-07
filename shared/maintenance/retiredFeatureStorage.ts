const RETIRED_EXACT_KEYS = new Set(["bidComparisonAgentSettings:v1"]);
const RETIRED_KEY_PREFIXES = ["bid-comparison-folder:"];

interface BrowserStorageLike {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

export const cleanupRetiredFeatureStorage = (
  storage: BrowserStorageLike | null | undefined,
): void => {
  if (!storage) return;

  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => key !== null);

  keys.forEach((key) => {
    if (
      RETIRED_EXACT_KEYS.has(key) ||
      RETIRED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
    ) {
      storage.removeItem(key);
    }
  });
};
