import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PRELOAD_RECOVERY_COOLDOWN_MS,
  installVitePreloadRecovery,
} from "@app/runtime/vitePreloadRecovery";

describe("Vite preload recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.sessionStorage.clear();
  });

  it("provede nejvýše jeden automatický reload během cooldownu", () => {
    const reload = vi.fn();
    const cleanupFirstLoad = installVitePreloadRecovery({ reload, now: () => 1_000 });
    const firstError = new CustomEvent("vite:preloadError", { cancelable: true });

    window.dispatchEvent(firstError);

    expect(firstError.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    cleanupFirstLoad();

    const reloadAfterRefresh = vi.fn();
    const cleanupAfterRefresh = installVitePreloadRecovery({
      reload: reloadAfterRefresh,
      now: () => 1_001,
    });
    const repeatedError = new CustomEvent("vite:preloadError", { cancelable: true });

    window.dispatchEvent(repeatedError);

    expect(repeatedError.defaultPrevented).toBe(false);
    expect(reloadAfterRefresh).not.toHaveBeenCalled();
    cleanupAfterRefresh();
  });

  it("po stabilním cooldownu dovolí nový jednorázový recovery pokus", () => {
    const firstReload = vi.fn();
    const cleanupFirstLoad = installVitePreloadRecovery({ reload: firstReload, now: () => 1_000 });
    window.dispatchEvent(new CustomEvent("vite:preloadError", { cancelable: true }));
    cleanupFirstLoad();

    vi.advanceTimersByTime(PRELOAD_RECOVERY_COOLDOWN_MS);

    const nextReload = vi.fn();
    const cleanupNextLoad = installVitePreloadRecovery({
      reload: nextReload,
      now: () => 1_000 + PRELOAD_RECOVERY_COOLDOWN_MS + 1,
    });
    window.dispatchEvent(new CustomEvent("vite:preloadError", { cancelable: true }));

    expect(nextReload).toHaveBeenCalledTimes(1);
    cleanupNextLoad();
  });

  it("bez zapisovatelného sessionStorage nere-loaduje a předá chybu boundary", () => {
    const reload = vi.fn();
    const blockedStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error("Storage blocked");
      }),
      removeItem: vi.fn(),
    } as unknown as Storage;
    const cleanup = installVitePreloadRecovery({
      reload,
      storage: blockedStorage,
      now: () => 1_000,
    });
    const preloadError = new CustomEvent("vite:preloadError", { cancelable: true });

    window.dispatchEvent(preloadError);

    expect(preloadError.defaultPrevented).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    cleanup();
  });
});
