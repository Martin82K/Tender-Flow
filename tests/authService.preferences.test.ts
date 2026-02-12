import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  getStoredAuthSessionRaw: vi.fn(),
  authGetSession: vi.fn(),
  from: vi.fn(),
  invokePublicFunction: vi.fn(),
}));

let failUpsert = false;
let lastUpsertPayload: any = null;

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

import { authService } from "../services/authService";

describe("authService.updateUserPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    failUpsert = false;
    lastUpsertPayload = null;
    localStorage.clear();

    localStorage.setItem(
      "crm-user-cache",
      JSON.stringify({
        timestamp: Date.now(),
        user: {
          id: "user-1",
          email: "cached@example.com",
          name: "Cached User",
          role: "user",
          subscriptionTier: "free",
          preferences: {
            theme: "system",
            primaryColor: "#607AFB",
            backgroundColor: "#f5f6f8",
            autoShortenProjectDocs: true,
          },
        },
      })
    );

    mockState.getStoredAuthSessionRaw.mockReturnValue(
      JSON.stringify({
        access_token: "token-1234567890",
        user: {
          id: "user-1",
          email: "db@example.com",
        },
      })
    );

    mockState.authGetSession.mockResolvedValue({
      data: { session: null },
    });

    mockState.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { is_admin: false },
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
                data: {
                  preferences: {
                    theme: "light",
                    primaryColor: "#607AFB",
                    backgroundColor: "#f5f6f8",
                    autoShortenProjectDocs: false,
                  },
                },
                error: null,
              }),
            }),
          }),
          upsert: vi.fn().mockImplementation((payload: any) => {
            lastUpsertPayload = payload;
            return {
              select: vi.fn().mockResolvedValue(
                failUpsert
                  ? { data: null, error: { message: "upsert failed" } }
                  : { data: [payload], error: null }
              ),
            };
          }),
        };
      }

      if (table === "user_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { subscription_tier_override: null },
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
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table access in test: ${table}`);
    });
  });

  it("keeps DB value for autoShortenProjectDocs when only theme changes", async () => {
    const updatedUser = await authService.updateUserPreferences({ theme: "dark" });

    expect(lastUpsertPayload.preferences).toMatchObject({
      theme: "dark",
      autoShortenProjectDocs: false,
    });
    expect(updatedUser.preferences).toMatchObject({
      theme: "dark",
      autoShortenProjectDocs: false,
    });

    const cached = JSON.parse(localStorage.getItem("crm-user-cache") || "{}");
    expect(cached.user.preferences).toMatchObject({
      theme: "dark",
      autoShortenProjectDocs: false,
    });
  });

  it("throws when preference upsert fails", async () => {
    failUpsert = true;

    await expect(
      authService.updateUserPreferences({ theme: "dark" })
    ).rejects.toBeTruthy();
  });
});
