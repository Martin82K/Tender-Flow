import { describe, expect, it, vi } from "vitest";

const loadService = async () => {
  const clearStoredSessionData = vi.fn();
  const clearCredentials = vi.fn(async () => {
    await Promise.resolve();
  });
  const navigate = vi.fn();

  vi.doMock("../services/supabase", () => ({
    clearStoredSessionData,
    getStoredAuthSessionRaw: vi.fn(),
    setRememberMePreference: vi.fn(),
    supabase: {
      auth: {
        refreshSession: vi.fn(),
        getSession: vi.fn(),
      },
    },
  }));

  vi.doMock("../services/platformAdapter", () => ({
    platformAdapter: {
      session: {
        clearCredentials,
      },
    },
  }));

  vi.doMock("../shared/routing/router", () => ({
    navigate,
  }));

  const { authSessionService } = await import("../services/authSessionService");
  return { authSessionService, clearStoredSessionData, clearCredentials, navigate };
};

describe("authSessionService.invalidateAuthState", () => {
  it("je idempotentní při paralelním volání", async () => {
    vi.resetModules();

    const {
      authSessionService,
      clearStoredSessionData,
      clearCredentials,
      navigate,
    } = await loadService();

    await Promise.all([
      authSessionService.invalidateAuthState({ navigateToLogin: true }),
      authSessionService.invalidateAuthState({ navigateToLogin: true }),
      authSessionService.invalidateAuthState({ navigateToLogin: true }),
    ]);

    expect(clearStoredSessionData).toHaveBeenCalledTimes(1);
    expect(clearCredentials).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  it("opakované volání v cooldownu nespustí druhý cleanup", async () => {
    vi.resetModules();

    const {
      authSessionService,
      clearStoredSessionData,
      clearCredentials,
      navigate,
    } = await loadService();

    await authSessionService.invalidateAuthState({ navigateToLogin: true });
    await authSessionService.invalidateAuthState({ navigateToLogin: true });

    expect(clearStoredSessionData).toHaveBeenCalledTimes(1);
    expect(clearCredentials).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
