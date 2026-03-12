import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
  challengeAndVerify: vi.fn(),
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: mockState.getAuthenticatorAssuranceLevel,
        listFactors: mockState.listFactors,
        enroll: mockState.enroll,
        unenroll: mockState.unenroll,
        challenge: mockState.challenge,
        verify: mockState.verify,
        challengeAndVerify: mockState.challengeAndVerify,
      },
    },
  },
}));

describe("adminMfaService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });
    mockState.listFactors.mockResolvedValue({
      data: {
        all: [
          {
            id: "factor-1",
            factor_type: "totp",
            status: "verified",
            friendly_name: "Tender Flow Admin",
          },
        ],
        totp: [],
        phone: [],
        webauthn: [],
      },
      error: null,
    });
    mockState.enroll.mockResolvedValue({
      data: {
        id: "factor-2",
        friendly_name: "Tender Flow Admin TOTP",
        totp: {
          qr_code: "<svg></svg>",
          secret: "SECRET123",
          uri: "otpauth://totp/example",
        },
      },
      error: null,
    });
    mockState.unenroll.mockResolvedValue({ data: null, error: null });
    mockState.challenge.mockResolvedValue({
      data: { id: "challenge-1" },
      error: null,
    });
    mockState.verify.mockResolvedValue({ data: {}, error: null });
    mockState.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
  });

  it("vrátí MFA status pro admina", async () => {
    const { getAdminMfaStatus } = await import("@/features/settings/api/adminMfaService");

    const result = await getAdminMfaStatus({ role: "admin" });

    expect(result.required).toBe(true);
    expect(result.verifiedFactors).toHaveLength(1);
    expect(result.needsVerification).toBe(true);
  });

  it("nevyžaduje další ověření pokud je session už na AAL2", async () => {
    mockState.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2" },
      error: null,
    });

    const { getAdminMfaStatus } = await import("@/features/settings/api/adminMfaService");

    const result = await getAdminMfaStatus({ role: "admin" });

    expect(result.needsVerification).toBe(false);
  });

  it("přeskočí MFA pro neadmin účty", async () => {
    const { getAdminMfaStatus } = await import("@/features/settings/api/adminMfaService");

    const result = await getAdminMfaStatus({ role: "user" });

    expect(result.required).toBe(false);
    expect(mockState.listFactors).not.toHaveBeenCalled();
  });

  it("umí založit TOTP enrollment", async () => {
    const { startAdminMfaEnrollment } = await import("@/features/settings/api/adminMfaService");

    const result = await startAdminMfaEnrollment();

    expect(mockState.enroll).toHaveBeenCalledWith({
      factorType: "totp",
      friendlyName: "Tender Flow Admin TOTP",
      issuer: "Tender Flow",
    });
    expect(result.secret).toBe("SECRET123");
  });

  it("před novým enrollmentem smaže starý neověřený TOTP faktor se stejným jménem", async () => {
    mockState.listFactors.mockResolvedValue({
      data: {
        all: [
          {
            id: "factor-stale",
            factor_type: "totp",
            status: "unverified",
            friendly_name: "Tender Flow Admin TOTP",
          },
        ],
        totp: [],
        phone: [],
        webauthn: [],
      },
      error: null,
    });

    const { startAdminMfaEnrollment } = await import("@/features/settings/api/adminMfaService");

    await startAdminMfaEnrollment();

    expect(mockState.unenroll).toHaveBeenCalledWith({
      factorId: "factor-stale",
    });
    expect(mockState.enroll).toHaveBeenCalledTimes(1);
  });

  it("umí ověřit enrollment přes challenge a verify", async () => {
    const { verifyAdminMfaEnrollment } = await import(
      "@/features/settings/api/adminMfaService"
    );

    await verifyAdminMfaEnrollment({
      factorId: "factor-2",
      code: "123456",
    });

    expect(mockState.challenge).toHaveBeenCalledWith({ factorId: "factor-2" });
    expect(mockState.verify).toHaveBeenCalledWith({
      factorId: "factor-2",
      challengeId: "challenge-1",
      code: "123456",
    });
  });

  it("umí povýšit admin session na AAL2", async () => {
    const { elevateAdminMfaSession } = await import("@/features/settings/api/adminMfaService");

    await elevateAdminMfaSession({
      factorId: "factor-1",
      code: "654321",
    });

    expect(mockState.challengeAndVerify).toHaveBeenCalledWith({
      factorId: "factor-1",
      code: "654321",
    });
  });
});
