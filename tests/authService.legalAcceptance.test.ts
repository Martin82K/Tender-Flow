import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/shared/legal/legalDocumentVersions";

const mockState = vi.hoisted(() => ({
  getStoredAuthSessionRaw: vi.fn(),
  authGetSession: vi.fn(),
  authSignUp: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  invokePublicFunction: vi.fn(),
}));

vi.mock("../services/supabase", () => ({
  supabase: {
    auth: {
      getSession: mockState.authGetSession,
      signUp: mockState.authSignUp,
      verifyOtp: mockState.verifyOtp,
      updateUser: mockState.updateUser,
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
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_AUTH_APP_ORIGIN", "https://www.tenderflow.cz");
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
          signup_legal_acceptance: { termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION },
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

  it("defaults to the current web origin when no Auth origin override is configured", async () => {
    vi.stubEnv("VITE_AUTH_APP_ORIGIN", "");
    mockState.authSignUp.mockResolvedValue({ data: { user: { id: "pending" }, session: null }, error: null });
    await authService.register("Pending", "pending@example.com", "password", {
      termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION,
    }, "/app/project/fixture");
    expect(mockState.authSignUp.mock.calls.at(-1)[0].options.emailRedirectTo).toBe(window.location.origin + "/app/project/fixture");
  });
  it.each(["https://staging.tenderflow.test", "http://127.0.0.1:3000"])("uses the configured Auth app origin %s", async origin => {
    vi.stubEnv("VITE_AUTH_APP_ORIGIN", origin);
    mockState.authSignUp.mockResolvedValue({ data: { user: { id: "pending" }, session: null }, error: null });
    await authService.register("Pending", "pending@example.com", "password", {
      termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION,
    }, "/app/project/fixture");
    expect(mockState.authSignUp).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ emailRedirectTo: origin + "/app/project/fixture" }) }));
    expect(mockState.authSignUp.mock.calls.at(-1)[0].options.data.signup_legal_acceptance)
      .toEqual({ termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION });
  });

  it("passes the original internal destination into the email confirmation", async () => {
    mockState.authSignUp.mockResolvedValue({ data: { user: { id: "pending" }, session: null }, error: null });
    await authService.register("Pending", "pending@example.com", "password", {
      termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION,
    }, "/app/project/fixture?tab=tasks");
    expect(mockState.authSignUp).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ emailRedirectTo: "https://www.tenderflow.cz/app/project/fixture?tab=tasks" }),
    }));
  });

  it("po registraci bez potvrzení e-mailu neudělí session ani nezapisuje souhlasy", async () => {
    mockState.authSignUp.mockResolvedValue({ data: { user: { id: "pending-user" }, session: null }, error: null });
    await expect(authService.register("Pending", "pending@example.com", "password", {
      termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION,
    })).resolves.toBeNull();
    expect(mockState.rpc).not.toHaveBeenCalled();
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

describe("Auth password recovery service", () => {
  beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); vi.stubGlobal("crypto", webcrypto); });
  afterEach(() => vi.unstubAllGlobals());
  it("verifies only recovery tokens and updates the current authenticated user", async () => {
    mockState.verifyOtp.mockResolvedValue({ data: { session: { user: { id: "recovery-user" }, expires_at: Date.now()/1000 + 3600 } }, error: null });
    mockState.updateUser.mockResolvedValue({ error: null });
    await authService.verifyPasswordRecoveryToken("hash");
    await authService.updateRecoveredPassword("new-password");
    expect(mockState.verifyOtp).toHaveBeenCalledWith({ token_hash: "hash", type: "recovery" });
    expect(mockState.updateUser).toHaveBeenCalledWith({ password: "new-password" });
  });
  it("binds reload recovery to the verified token fingerprint, user and lifetime", async () => {
    mockState.verifyOtp.mockResolvedValue({ data: { session: { user: { id: "recovery-user" }, expires_at: Date.now()/1000 + 3600 } }, error: null });
    mockState.authGetSession.mockResolvedValue({ data: { session: { user: { id: "recovery-user" } } }, error: null });
    await authService.verifyPasswordRecoveryToken("private-recovery-token");
    expect(sessionStorage.getItem("tf-password-recovery-verification")).not.toContain("private-recovery-token");
    expect(await authService.hasVerifiedPasswordRecoveryToken("private-recovery-token")).toBe(true);
    expect(await authService.hasVerifiedPasswordRecoveryToken("different-token")).toBe(false);
    mockState.authGetSession.mockResolvedValue({ data: { session: { user: { id: "different-user" } } }, error: null });
    expect(await authService.hasVerifiedPasswordRecoveryToken("private-recovery-token")).toBe(false);
    const marker = JSON.parse(sessionStorage.getItem("tf-password-recovery-verification")!);
    sessionStorage.setItem("tf-password-recovery-verification", JSON.stringify({ ...marker, expiresAt: 0 }));
    expect(await authService.hasVerifiedPasswordRecoveryToken("private-recovery-token")).toBe(false);
  });
  it("propagates verification and password policy errors", async () => {
    mockState.verifyOtp.mockResolvedValue({ error: new Error("expired") });
    mockState.updateUser.mockResolvedValue({ error: new Error("password policy") });
    await expect(authService.verifyPasswordRecoveryToken("hash")).rejects.toThrow("expired");
    await expect(authService.updateRecoveredPassword("weak")).rejects.toThrow("password policy");
  });
});
