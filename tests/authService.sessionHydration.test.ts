import { beforeEach, describe, expect, it, vi } from "vitest";
import { testConsoleGuard } from "./utils/consoleGuard";
import { waitFor } from "@testing-library/react";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/shared/legal/legalDocumentVersions";

const mockState = vi.hoisted(() => ({
  getStoredAuthSessionRaw: vi.fn(),
  authGetSession: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  invokePublicFunction: vi.fn(),
}));

let platformAdminActive = false;
let subscriptionOverride: string | null = null;
let organizationId: string | null = null;
let organizationMemberships: Array<{ organization_id: string; is_active: boolean; organization: { type: string } }> | null = null;
let organizationTier: string | null = null;
let userSettingsPreferences: any = null;
let legalAcceptanceRow: any = null;

vi.mock("../services/supabase", () => ({
  supabase: {
    auth: {
      getSession: mockState.authGetSession,
    },
    from: mockState.from,
    rpc: mockState.rpc,
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

    platformAdminActive = false;
    subscriptionOverride = null;
    organizationId = null;
    organizationMemberships = null;
    organizationTier = null;
    userSettingsPreferences = {
      theme: "system",
      primaryColor: "#607AFB",
      backgroundColor: "#f5f6f8",
    };
    legalAcceptanceRow = {
      subscription_tier_override: subscriptionOverride,
      terms_version: null,
      terms_accepted_at: null,
      privacy_version: null,
      privacy_accepted_at: null,
    };

    mockState.rpc.mockReset();
    mockState.getStoredAuthSessionRaw.mockReturnValue(null);
    mockState.authGetSession.mockResolvedValue({ data: { session: null } });

    mockState.from.mockImplementation((table: string) => {
      if (table === "platform_admins") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: platformAdminActive ? { user_id: "user-1" } : null,
                  error: null,
                }),
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
                data: legalAcceptanceRow,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "organization_members") {
        const rows = organizationMemberships ?? (organizationId ? [{ organization_id: organizationId, is_active: true, organization: { type: "business" } }] : []);
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(Object.assign(
          Promise.resolve({ data: rows, error: null }),
          { limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: rows[0] ?? null, error: null }) }) }
        )) }) };
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

  it("selects the active business membership after approval ahead of a personal fallback", async () => {
    organizationMemberships = [
      { organization_id: "a-personal", is_active: true, organization: { type: "personal" } },
      { organization_id: "z-company", is_active: true, organization: { type: "business" } },
      { organization_id: "b-disabled", is_active: false, organization: { type: "business" } },
    ];
    expect((await authService.getUserFromSession(makeSession(), { skipUserCache: true }))?.organizationId).toBe("z-company");
    organizationMemberships.reverse();
    expect((await authService.getUserFromSession(makeSession(), { skipUserCache: true }))?.organizationId).toBe("z-company");
  });
  it("selects a licensed personal workspace over an expired company", async () => {
    organizationMemberships = [
      { organization_id: "company", is_active: true, organization: { type: "business" } },
      { organization_id: "personal", is_active: true, organization: { type: "personal" } },
    ];
    mockState.rpc.mockImplementation((name: string, args: { organization_id_input: string }) =>
      Promise.resolve({ data: name === "has_resource_subscription" && args.organization_id_input === "personal", error: null }));
    expect((await authService.getUserFromSession(makeSession(), { skipUserCache: true }))?.organizationId).toBe("personal");
    organizationMemberships.reverse();
    expect((await authService.getUserFromSession(makeSession(), { skipUserCache: true }))?.organizationId).toBe("personal");
  });

  it("prefers a licensed company and never selects an inactive licensed membership", async () => {
    organizationMemberships = [
      { organization_id: "personal", is_active: true, organization: { type: "personal" } },
      { organization_id: "company", is_active: true, organization: { type: "business" } },
      { organization_id: "disabled", is_active: false, organization: { type: "business" } },
    ];
    mockState.rpc.mockResolvedValue({ data: true, error: null });
    expect((await authService.getUserFromSession(makeSession(), { skipUserCache: true }))?.organizationId).toBe("company");
    expect(mockState.rpc).not.toHaveBeenCalledWith("has_resource_subscription", { organization_id_input: "disabled" });
  });

  it("retains a deterministic recovery workspace when licence checks fail", async () => {
    organizationMemberships = [
      { organization_id: "personal", is_active: true, organization: { type: "personal" } },
      { organization_id: "company", is_active: true, organization: { type: "business" } },
    ];
    mockState.rpc.mockResolvedValue({ data: null, error: { message: "Offline" } });
    expect((await authService.getUserFromSession(makeSession(), { skipUserCache: true }))?.organizationId).toBe("company");
  });
  const pendingSession = () => ({ user: { ...makeSession().user, email_confirmed_at: "2026-09-19T08:00:00Z", user_metadata: {
    name: "User One", signup_legal_acceptance: { termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION },
  } } });
  it("completes signup consent after verification using server audit timestamps", async () => {
    const accepted = { ...legalAcceptanceRow, terms_version: CURRENT_TERMS_VERSION, privacy_version: CURRENT_PRIVACY_VERSION,
      terms_accepted_at: "2026-09-19T08:00:01Z", privacy_accepted_at: "2026-09-19T08:00:01Z" };
    mockState.rpc.mockResolvedValue({ data: accepted, error: null });
    const user = await authService.getUserFromSession(pendingSession(), { skipUserCache: true });
    expect(mockState.rpc).toHaveBeenCalledWith("accept_current_legal_documents", { p_terms_version: CURRENT_TERMS_VERSION, p_privacy_version: CURRENT_PRIVACY_VERSION });
    expect(user?.legalAcceptance?.termsAcceptedAt).toBe(accepted.terms_accepted_at);
    legalAcceptanceRow = accepted;
    mockState.rpc.mockClear();
    await authService.getUserFromSession(pendingSession(), { skipUserCache: true });
    expect(mockState.rpc).not.toHaveBeenCalled();
  });
  it("keeps consent unaccepted on RPC failure and retries it on the next hydration", async () => {
    testConsoleGuard.expect("warn", "Could not fetch subscription override");
    mockState.rpc.mockResolvedValueOnce({ data: null, error: new Error("temporary failure") });
    const first = await authService.getUserFromSession(pendingSession(), { skipUserCache: true });
    expect(first?.legalAcceptance?.termsAcceptedAt).toBeNull();
    mockState.rpc.mockResolvedValueOnce({ data: { ...legalAcceptanceRow,
      terms_version: CURRENT_TERMS_VERSION, privacy_version: CURRENT_PRIVACY_VERSION,
      terms_accepted_at: "2026-09-19T08:00:01Z", privacy_accepted_at: "2026-09-19T08:00:01Z" }, error: null });
    const retry = await authService.getUserFromSession(pendingSession(), { skipUserCache: true });
    expect(retry?.legalAcceptance?.termsAcceptedAt).toBe("2026-09-19T08:00:01Z");
    expect(mockState.rpc).toHaveBeenCalledTimes(2);
  });
  it.each(["unconfirmed", "stale"])("does not auto-accept %s registration metadata", async scenario => {
    const session = pendingSession();
    if (scenario === "unconfirmed") session.user.email_confirmed_at = "";
    else session.user.user_metadata.signup_legal_acceptance.termsVersion = "old";
    const user = await authService.getUserFromSession(session, { skipUserCache: true });
    expect(mockState.rpc).not.toHaveBeenCalled();
    expect(user?.legalAcceptance?.termsAcceptedAt).toBeNull();
  });

  it("respektuje override tier starter při cold startu", async () => {
    subscriptionOverride = "starter";
    organizationId = "org-1";
    organizationTier = "enterprise";
    legalAcceptanceRow = {
      subscription_tier_override: "starter",
      terms_version: null,
      terms_accepted_at: null,
      privacy_version: null,
      privacy_accepted_at: null,
    };

    const user = await authService.getUserFromSession(makeSession(), {
      skipUserCache: true,
    });

    expect(user?.subscriptionTier).toBe("starter");
  });

  it("použije organization tier starter když override není nastaven", async () => {
    subscriptionOverride = null;
    organizationId = "org-1";
    organizationTier = "starter";
    legalAcceptanceRow = {
      subscription_tier_override: null,
      terms_version: null,
      terms_accepted_at: null,
      privacy_version: null,
      privacy_accepted_at: null,
    };

    const user = await authService.getUserFromSession(makeSession(), {
      skipUserCache: true,
    });

    expect(user?.subscriptionTier).toBe("starter");
  });

  it("při chybějícím override i organization tier neobnoví stale cached tier", async () => {
    localStorage.setItem(
      "crm-subscription-tier-cache",
      JSON.stringify({
        tier: "pro",
        timestamp: Date.now(),
      }),
    );

    subscriptionOverride = null;
    organizationId = null;
    organizationMemberships = null;
    organizationTier = null;
    legalAcceptanceRow = {
      subscription_tier_override: null,
      terms_version: null,
      terms_accepted_at: null,
      privacy_version: null,
      privacy_accepted_at: null,
    };

    const user = await authService.getUserFromSession(makeSession(), {
      skipUserCache: true,
    });

    expect(user?.subscriptionTier).toBe("free");
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
          legalAcceptance: {
            termsVersion: CURRENT_TERMS_VERSION,
            termsAcceptedAt: "2026-03-15T11:00:00.000Z",
            privacyVersion: CURRENT_PRIVACY_VERSION,
            privacyAcceptedAt: "2026-03-15T11:00:00.000Z",
          },
          preferences: {
            theme: "system",
            primaryColor: "#607AFB",
            backgroundColor: "#f5f6f8",
          },
        },
      })
    );
    subscriptionOverride = "pro";
    legalAcceptanceRow = {
      subscription_tier_override: subscriptionOverride,
      terms_version: CURRENT_TERMS_VERSION,
      terms_accepted_at: "2026-03-15T11:00:00.000Z",
      privacy_version: CURRENT_PRIVACY_VERSION,
      privacy_accepted_at: "2026-03-15T11:00:00.000Z",
    };

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

  it("načte verze a timestampy právních dokumentů z user_profiles", async () => {
    legalAcceptanceRow = {
      subscription_tier_override: null,
      terms_version: CURRENT_TERMS_VERSION,
      terms_accepted_at: "2026-03-15T10:30:00.000Z",
      privacy_version: CURRENT_PRIVACY_VERSION,
      privacy_accepted_at: "2026-03-15T10:31:00.000Z",
    };

    const user = await authService.getUserFromSession(makeSession(), {
      skipUserCache: true,
    });

    expect(user?.legalAcceptance).toEqual({
      termsVersion: CURRENT_TERMS_VERSION,
      termsAcceptedAt: "2026-03-15T10:30:00.000Z",
      privacyVersion: CURRENT_PRIVACY_VERSION,
      privacyAcceptedAt: "2026-03-15T10:31:00.000Z",
    });
  });

  it("nastaví admin role a tier podle platform_admins", async () => {
    platformAdminActive = true;
    organizationId = "org-1";
    organizationTier = "starter";

    const user = await authService.getUserFromSession(makeSession(), {
      skipUserCache: true,
    });

    expect(user?.role).toBe("admin");
    expect(user?.subscriptionTier).toBe("admin");
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
