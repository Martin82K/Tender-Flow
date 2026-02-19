import { describe, expect, it, vi } from "vitest";

const loadQueryClient = async () => {
  vi.resetModules();

  const invalidateAuthState = vi.fn().mockResolvedValue(undefined);
  const navigate = vi.fn();

  vi.doMock("../services/authSessionService", () => ({
    authSessionService: {
      invalidateAuthState,
    },
  }));

  vi.doMock("../shared/routing/router", () => ({
    navigate,
  }));

  const { queryClient } = await import("../services/queryClient");
  return { queryClient, invalidateAuthState, navigate };
};

describe("queryClient auth handling", () => {
  it("deleguje auth recovery do authSessionService bez přímé navigace", async () => {
    const { queryClient, invalidateAuthState, navigate } = await loadQueryClient();
    const retry = queryClient.getDefaultOptions().queries?.retry as (
      failureCount: number,
      error: unknown,
    ) => boolean;

    expect(retry(0, new Error("401 Invalid token"))).toBe(false);
    expect(retry(0, new Error("Unauthorized session"))).toBe(false);
    expect(retry(0, new Error("jwt expired"))).toBe(false);

    expect(invalidateAuthState).toHaveBeenCalledTimes(1);
    expect(invalidateAuthState).toHaveBeenCalledWith({
      navigateToLogin: true,
      reason: "auth_fetch_errors",
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("ne-auth chyby retryne jednou a nespouští auth recovery", async () => {
    const { queryClient, invalidateAuthState } = await loadQueryClient();
    const retry = queryClient.getDefaultOptions().queries?.retry as (
      failureCount: number,
      error: unknown,
    ) => boolean;

    expect(retry(0, new Error("Network timeout"))).toBe(true);
    expect(retry(1, new Error("Network timeout"))).toBe(false);

    expect(invalidateAuthState).not.toHaveBeenCalled();
  });

  it("mutace při auth chybách také delegují recovery centrálně", async () => {
    const { queryClient, invalidateAuthState } = await loadQueryClient();
    const onError = queryClient.getDefaultOptions().mutations?.onError as (
      error: unknown,
    ) => void;

    onError(new Error("401"));
    onError(new Error("token invalid"));
    onError(new Error("session expired"));

    expect(invalidateAuthState).toHaveBeenCalledTimes(1);
  });
});
