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

describe("mfaService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1" },
      error: null,
    });
    mockState.listFactors.mockResolvedValue({
      data: { all: [], totp: [], phone: [], webauthn: [] },
      error: null,
    });
    mockState.enroll.mockResolvedValue({
      data: {
        id: "factor-new",
        friendly_name: "Tender Flow Authenticator",
        totp: {
          qr_code: "<svg></svg>",
          secret: "SECRET123",
          uri: "otpauth://totp/tender-flow",
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

  it("vrátí stav bez MFA faktorů", async () => {
    const { mfaService } = await import("@/infra/auth/mfaService");

    const status = await mfaService.getStatus();

    expect(status.hasVerifiedFactor).toBe(false);
    expect(status.needsVerification).toBe(false);
    expect(status.verifiedFactors).toHaveLength(0);
  });

  it("pozná verified faktor a potřebu AAL2 ověření", async () => {
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
            friendly_name: "Telefon",
          },
        ],
      },
      error: null,
    });
    const { mfaService } = await import("@/infra/auth/mfaService");

    const status = await mfaService.getStatus();
    const challenge = await mfaService.getLoginChallenge();

    expect(status.needsVerification).toBe(true);
    expect(challenge).toEqual({
      factorId: "factor-1",
      factorType: "totp",
      friendlyName: "Telefon",
    });
  });

  it("založí TOTP enrollment a uklidí starý neověřený faktor stejného jména", async () => {
    mockState.listFactors.mockResolvedValue({
      data: {
        all: [
          {
            id: "stale-factor",
            factor_type: "totp",
            status: "unverified",
            friendly_name: "Tender Flow Authenticator",
          },
        ],
      },
      error: null,
    });
    const { mfaService } = await import("@/infra/auth/mfaService");

    const enrollment = await mfaService.startTotpEnrollment();

    expect(mockState.unenroll).toHaveBeenCalledWith({ factorId: "stale-factor" });
    expect(mockState.enroll).toHaveBeenCalledWith({
      factorType: "totp",
      friendlyName: "Tender Flow Authenticator",
      issuer: "Tender Flow",
    });
    expect(enrollment.secret).toBe("SECRET123");
  });

  it("ověří enrollment přes challenge a verify", async () => {
    const { mfaService } = await import("@/infra/auth/mfaService");

    await mfaService.verifyEnrollment({ factorId: "factor-1", code: "123456" });

    expect(mockState.challenge).toHaveBeenCalledWith({ factorId: "factor-1" });
    expect(mockState.verify).toHaveBeenCalledWith({
      factorId: "factor-1",
      challengeId: "challenge-1",
      code: "123456",
    });
  });

  it("ověří login faktor a umí faktor odebrat", async () => {
    const { mfaService } = await import("@/infra/auth/mfaService");

    await mfaService.verifyFactor({ factorId: "factor-1", code: "654321" });
    await mfaService.unenrollFactor("factor-1");

    expect(mockState.challengeAndVerify).toHaveBeenCalledWith({
      factorId: "factor-1",
      code: "654321",
    });
    expect(mockState.unenroll).toHaveBeenCalledWith({ factorId: "factor-1" });
  });
});
