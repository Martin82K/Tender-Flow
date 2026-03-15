import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  getCachedSubscriptionTier: vi.fn(),
}));

vi.mock("../services/supabase", () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
    },
    rpc: mocks.rpc,
    from: vi.fn(),
  },
}));

vi.mock("../services/authService", () => ({
  getCachedSubscriptionTier: mocks.getCachedSubscriptionTier,
}));

describe("subscriptionFeaturesService.getUserSubscriptionTier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mocks.getCachedSubscriptionTier.mockReturnValue(null);
  });

  it("bez uživatele vrátí cached tier bez debug logů", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.getCachedSubscriptionTier.mockReturnValue("admin");

    const { subscriptionFeaturesService } = await import("../services/subscriptionFeaturesService");

    const tier = await subscriptionFeaturesService.getUserSubscriptionTier();

    expect(tier).toBe("admin");
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("při RPC chybě vrátí cached tier a loguje jen sanitizovanou chybu", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.getCachedSubscriptionTier.mockReturnValue("pro");
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        message: "Kontakt john@example.com token Bearer abc.def.ghi",
        details: "authorization=secret",
      },
    });

    const { subscriptionFeaturesService } = await import("../services/subscriptionFeaturesService");

    const tier = await subscriptionFeaturesService.getUserSubscriptionTier();

    expect(tier).toBe("pro");
    const loggedPayload = JSON.stringify(consoleErrorSpy.mock.calls[0]?.[1]);
    expect(loggedPayload).toContain("[redacted-email]");
    expect(loggedPayload).toContain("[redacted-token]");
    expect(loggedPayload).not.toContain("john@example.com");
    expect(loggedPayload).not.toContain("secret");
  });
});
