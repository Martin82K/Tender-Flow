import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/shared/legal/legalDocumentVersions";

const mockState = vi.hoisted(() => ({
  getStoredAuthSessionRaw: vi.fn(),
  authGetSession: vi.fn(),
  authSignUp: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  invokePublicFunction: vi.fn(),
}));

vi.mock("../services/supabase", () => ({
  supabase: {
    auth: {
      getSession: mockState.authGetSession,
      signUp: mockState.authSignUp,
    },
    from: mockState.from,
    rpc: mockState.rpc,
  },
  getStoredAuthSessionRaw: mockState.getStoredAuthSessionRaw,
}));

vi.mock("../services/functionsClient", () => ({
  invokePublicFunction: mockState.invokePublicFunction,
}));

import { authService } from "../services/authService";

describe("authService legal acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockState.getStoredAuthSessionRaw.mockReturnValue(null);
    mockState.authGetSession.mockResolvedValue({ data: { session: null } });
    mockState.rpc.mockResolvedValue({ error: null });
    mockState.authSignUp.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "user@example.com" },
        session: {
          user: {
            id: "user-1",
            email: "user@example.com",
            user_metadata: { name: "User One" },
          },
        },
      },
      error: null,
    });
    mockState.from.mockImplementation((table: string) => {
      if (table === "app_settings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  allow_public_registration: true,
                  allowed_domains: [],
                  require_email_whitelist: false,
                },
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table access in test: ${table}`);
    });
  });

  it("registrace po signUp uloží souhlasy přes RPC a vrátí hydratovaného uživatele", async () => {
    const hydratedUser = {
      id: "user-1",
      name: "User One",
      email: "user@example.com",
      role: "user" as const,
      subscriptionTier: "free" as const,
      preferences: {
        theme: "system" as const,
        primaryColor: "#607AFB",
        backgroundColor: "#f5f6f8",
      },
      legalAcceptance: {
        termsVersion: CURRENT_TERMS_VERSION,
        termsAcceptedAt: "2026-03-15T10:30:00.000Z",
        privacyVersion: CURRENT_PRIVACY_VERSION,
        privacyAcceptedAt: "2026-03-15T10:31:00.000Z",
      },
    };

    const hydrateSpy = vi
      .spyOn(authService, "getUserFromSession")
      .mockResolvedValue(hydratedUser);

    const acceptSpy = vi.spyOn(authService, "acceptLegalDocuments");

    const user = await authService.register(
      "User One",
      "user@example.com",
      "tajne-heslo",
      {
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
      },
    );

    expect(mockState.authSignUp).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "tajne-heslo",
      options: {
        data: {
          name: "User One",
        },
      },
    });
    expect(acceptSpy).toHaveBeenCalledWith(
      {
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
      },
      {
        session: {
          user: {
            id: "user-1",
            email: "user@example.com",
            user_metadata: { name: "User One" },
          },
        },
      },
    );
    expect(hydrateSpy).toHaveBeenCalled();
    expect(user).toBe(hydratedUser);
  });

  it("bez aktivní session nevolá RPC a vrátí srozumitelnou chybu", async () => {
    mockState.authGetSession.mockResolvedValue({ data: { session: null } });

    await expect(
      authService.acceptLegalDocuments({
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
      }),
    ).rejects.toThrow("Přihlášení vypršelo. Přihlaste se prosím znovu.");

    expect(mockState.rpc).not.toHaveBeenCalled();
  });
});
