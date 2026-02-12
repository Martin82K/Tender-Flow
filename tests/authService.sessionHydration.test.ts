import { beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";

const mockState = vi.hoisted(() => ({
  getStoredAuthSessionRaw: vi.fn(),
  authGetSession: vi.fn(),
  from: vi.fn(),
  invokePublicFunction: vi.fn(),
}));

let profileIsAdmin = false;
let subscriptionOverride: string | null = null;
let organizationId: string | null = null;
let organizationTier: string | null = null;
let userSettingsPreferences: any = null;

vi.mock("../services/supabase", () => ({
  supabase: {
    auth: {
      getSession: mockState.authGetSession,
    },
    from: mockState.from,
  },
  getStoredAuthSessionRaw: mockState.getStoredAuthSessionRaw,
}));

vi.mock("../services/functionsClient", () => ({
  invokePublicFunction: mockState.invokePublicFunction,
}));

import { authService, getCachedSubscriptionTier } from "../services/authService";

const makeSession = () => ({
  user: {
    id: "user-1",
    email: "user@example.com",
    user_metadata: { name: "User One" },
  },
});

describe("authService session hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    profileIsAdmin = false;
    subscriptionOverride = null;
    organizationId = null;
    organizationTier = null;
    userSettingsPreferences = {
      theme: "system",
      primaryColor: "#607AFB",
      backgroundColor: "#f5f6f8",
    };

    mockState.getStoredAuthSessionRaw.mockReturnValue(null);
    mockState.authGetSession.mockResolvedValue({ data: { session: null } });

    mockState.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { is_admin: profileIsAdmin },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "user_settings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: userSettingsPreferences
                  ? { preferences: userSettingsPreferences }
                  : null,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "user_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { subscription_tier_override: subscriptionOverride },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "organization_members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: organizationId ? { organization_id: organizationId } : null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "organizations") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: organizationTier
                  ? {
                      subscription_tier: organizationTier,
                      type: "business",
                      name: "Test Org",
                    }
                  : null,
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table access in test: ${table}`);
    });
  });

  it("respektuje override tier starter při cold startu", async () => {
    subscriptionOverride = "starter";
    organizationId = "org-1";
    organizationTier = "enterprise";

    const user = await authService.getUserFromSession(makeSession(), {
      skipUserCache: true,
    });

    expect(user?.subscriptionTier).toBe("starter");
  });

  it("použije organization tier starter když override není nastaven", async () => {
    subscriptionOverride = null;
    organizationId = "org-1";
    organizationTier = "starter";

    const user = await authService.getUserFromSession(makeSession(), {
      skipUserCache: true,
    });

    expect(user?.subscriptionTier).toBe("starter");
  });

  it("při cache-first vrátí cache, ale background refresh propaguje čerstvý tier", async () => {
    localStorage.setItem(
      "crm-user-cache",
      JSON.stringify({
        timestamp: Date.now(),
        user: {
          id: "user-1",
          email: "user@example.com",
          name: "Cached User",
          role: "user",
          subscriptionTier: "free",
          preferences: {
            theme: "system",
            primaryColor: "#607AFB",
            backgroundColor: "#f5f6f8",
          },
        },
      })
    );
    subscriptionOverride = "pro";

    const onBackgroundRefresh = vi.fn();
    const user = await authService.getUserFromSession(makeSession(), {
      onBackgroundRefresh,
    });

    expect(user?.subscriptionTier).toBe("free");

    await waitFor(() => {
      expect(onBackgroundRefresh).toHaveBeenCalledTimes(1);
    });
    expect(onBackgroundRefresh.mock.calls[0][0].subscriptionTier).toBe("pro");

    const cached = JSON.parse(localStorage.getItem("crm-user-cache") || "{}");
    expect(cached.user.subscriptionTier).toBe("pro");
  });

  it("ignoruje nevalidní tier v localStorage cache", () => {
    localStorage.setItem(
      "crm-subscription-tier-cache",
      JSON.stringify({
        tier: "superadmin",
        timestamp: Date.now(),
      })
    );

    expect(getCachedSubscriptionTier()).toBeNull();
    expect(localStorage.getItem("crm-subscription-tier-cache")).toBeNull();
  });
});
