const PRELOAD_RECOVERY_STORAGE_KEY = "vite_preload_recovery_at_v1";

export const PRELOAD_RECOVERY_COOLDOWN_MS = 30_000;

interface VitePreloadRecoveryOptions {
  reload?: () => void;
  now?: () => number;
  storage?: Storage;
  target?: Window;
}

const readRecoveryTimestamp = (storage: Storage): number | null => {
  try {
    const value = Number(storage.getItem(PRELOAD_RECOVERY_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

const writeRecoveryTimestamp = (storage: Storage, timestamp: number): boolean => {
  try {
    storage.setItem(PRELOAD_RECOVERY_STORAGE_KEY, String(timestamp));
    return true;
  } catch {
    return false;
  }
};

const clearRecoveryTimestamp = (storage: Storage, expectedTimestamp?: number): void => {
  try {
    if (expectedTimestamp !== undefined) {
      const currentTimestamp = readRecoveryTimestamp(storage);
      if (currentTimestamp !== expectedTimestamp) return;
    }
    storage.removeItem(PRELOAD_RECOVERY_STORAGE_KEY);
  } catch {
    // Storage can be blocked; recovery remains fail-safe for the current document.
  }
};

export const installVitePreloadRecovery = (
  options: VitePreloadRecoveryOptions = {},
): (() => void) => {
  const target = options.target ?? window;
  const storage = options.storage ?? target.sessionStorage;
  const reload = options.reload ?? (() => target.location.reload());
  const now = options.now ?? Date.now;
  let reloadScheduled = false;
  let cleanupTimer: number | undefined;

  const existingTimestamp = readRecoveryTimestamp(storage);
  if (existingTimestamp !== null) {
    const remainingCooldown = PRELOAD_RECOVERY_COOLDOWN_MS - (now() - existingTimestamp);
    if (remainingCooldown <= 0) {
      clearRecoveryTimestamp(storage, existingTimestamp);
    } else {
      cleanupTimer = target.setTimeout(() => {
        clearRecoveryTimestamp(storage, existingTimestamp);
      }, remainingCooldown);
    }
  }

  const handlePreloadError = (event: Event): void => {
    if (reloadScheduled) return;

    const timestamp = now();
    const previousTimestamp = readRecoveryTimestamp(storage);
    if (
      previousTimestamp !== null &&
      timestamp - previousTimestamp < PRELOAD_RECOVERY_COOLDOWN_MS
    ) {
      return;
    }

    if (!writeRecoveryTimestamp(storage, timestamp)) return;

    event.preventDefault();
    reloadScheduled = true;
    reload();
  };

  target.addEventListener("vite:preloadError", handlePreloadError);

  return () => {
    target.removeEventListener("vite:preloadError", handlePreloadError);
    if (cleanupTimer !== undefined) target.clearTimeout(cleanupTimer);
  };
};
