import { supabase } from "@/services/supabase";

export type MfaAal = "aal1" | "aal2";
export type MfaFactorType = "totp" | "phone" | "webauthn";
export type MfaFactorStatus = "verified" | "unverified";

export interface MfaFactor {
  id: string;
  factorType: MfaFactorType;
  status: MfaFactorStatus;
  friendlyName: string | null;
}

export interface MfaStatus {
  currentLevel: MfaAal | null;
  nextLevel: MfaAal | null;
  factors: MfaFactor[];
  verifiedFactors: MfaFactor[];
  unverifiedFactors: MfaFactor[];
  hasVerifiedFactor: boolean;
  needsVerification: boolean;
}

export interface MfaEnrollment {
  factorId: string;
  qrCodeSvg: string;
  secret: string;
  uri: string;
  friendlyName: string;
}

export interface MfaLoginChallenge {
  factorId: string;
  factorType: MfaFactorType;
  friendlyName: string | null;
}

const DEFAULT_TOTP_FRIENDLY_NAME = "Tender Flow Authenticator";
const ISSUER = "Tender Flow";

const normalizeAal = (value: unknown): MfaAal | null =>
  value === "aal1" || value === "aal2" ? value : null;

export const toMfaFactor = (factor: Record<string, unknown>): MfaFactor => ({
  id: String(factor.id || ""),
  factorType:
    factor.factor_type === "phone" ||
    factor.factor_type === "webauthn" ||
    factor.factor_type === "totp"
      ? factor.factor_type
      : "totp",
  status: factor.status === "verified" ? "verified" : "unverified",
  friendlyName: factor.friendly_name ? String(factor.friendly_name) : null,
});

const getAllFactors = (factors: unknown): MfaFactor[] => {
  const all = (factors as { all?: unknown[] } | null | undefined)?.all;
  if (!Array.isArray(all)) return [];
  return all
    .map((factor) => toMfaFactor(factor as Record<string, unknown>))
    .filter((factor) => factor.id);
};

const firstVerifiedFactor = (status: MfaStatus): MfaFactor | null =>
  status.verifiedFactors.find((factor) => factor.factorType === "totp") ??
  status.verifiedFactors[0] ??
  null;

export const mfaService = {
  getStatus: async (): Promise<MfaStatus> => {
    const [{ data: levels, error: levelsError }, { data: factors, error: factorsError }] =
      await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);

    if (levelsError) throw levelsError;
    if (factorsError) throw factorsError;

    const allFactors = getAllFactors(factors);
    const verifiedFactors = allFactors.filter((factor) => factor.status === "verified");
    const unverifiedFactors = allFactors.filter((factor) => factor.status !== "verified");
    const currentLevel = normalizeAal(levels?.currentLevel);
    const nextLevel = normalizeAal(levels?.nextLevel);

    return {
      currentLevel,
      nextLevel,
      factors: allFactors,
      verifiedFactors,
      unverifiedFactors,
      hasVerifiedFactor: verifiedFactors.length > 0,
      needsVerification: verifiedFactors.length > 0 && currentLevel !== "aal2",
    };
  },

  getLoginChallenge: async (): Promise<MfaLoginChallenge | null> => {
    const status = await mfaService.getStatus();
    if (!status.needsVerification) return null;

    const factor = firstVerifiedFactor(status);
    if (!factor) return null;

    return {
      factorId: factor.id,
      factorType: factor.factorType,
      friendlyName: factor.friendlyName,
    };
  },

  startTotpEnrollment: async (
    friendlyName = DEFAULT_TOTP_FRIENDLY_NAME,
  ): Promise<MfaEnrollment> => {
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;

    const staleUnverifiedTotpFactors = getAllFactors(factors).filter(
      (factor) =>
        factor.factorType === "totp" &&
        factor.status !== "verified" &&
        (factor.friendlyName || friendlyName) === friendlyName,
    );

    for (const factor of staleUnverifiedTotpFactors) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw error;
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName,
      issuer: ISSUER,
    });

    if (error) throw error;

    return {
      factorId: data.id,
      qrCodeSvg: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
      friendlyName: data.friendly_name || friendlyName,
    };
  },

  verifyEnrollment: async (input: { factorId: string; code: string }): Promise<void> => {
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: input.factorId,
    });

    if (challengeError) throw challengeError;

    const { error } = await supabase.auth.mfa.verify({
      factorId: input.factorId,
      challengeId: challenge.id,
      code: input.code.trim(),
    });

    if (error) throw error;
  },

  verifyFactor: async (input: { factorId: string; code: string }): Promise<void> => {
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: input.factorId,
      code: input.code.trim(),
    });

    if (error) throw error;
  },

  unenrollFactor: async (factorId: string): Promise<void> => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw error;
  },
};
