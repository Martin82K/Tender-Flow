import { supabase } from "@/services/supabase";
import type { User } from "@/types";

export interface AdminMfaFactor {
  id: string;
  factorType: "totp" | "phone" | "webauthn";
  status: "verified" | "unverified";
  friendlyName: string | null;
}

export interface AdminMfaStatus {
  required: boolean;
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
  verifiedFactors: AdminMfaFactor[];
  unverifiedFactors: AdminMfaFactor[];
  needsEnrollment: boolean;
  needsVerification: boolean;
}

export interface AdminMfaEnrollment {
  factorId: string;
  qrCodeSvg: string;
  secret: string;
  friendlyName: string;
}

const defaultStatus: AdminMfaStatus = {
  required: false,
  currentLevel: null,
  nextLevel: null,
  verifiedFactors: [],
  unverifiedFactors: [],
  needsEnrollment: false,
  needsVerification: false,
};

const toFactor = (
  factor: Record<string, unknown>,
): AdminMfaFactor => ({
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

export const getAdminMfaStatus = async (
  user: Pick<User, "role"> | null | undefined,
): Promise<AdminMfaStatus> => {
  if (!user || user.role !== "admin") return defaultStatus;

  const [{ data: levels, error: levelsError }, { data: factors, error: factorsError }] =
    await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);

  if (levelsError) throw levelsError;
  if (factorsError) throw factorsError;

  const verifiedFactors = Array.isArray(factors?.all)
    ? factors.all
        .filter((factor) => factor.status === "verified")
        .map((factor) => toFactor(factor as unknown as Record<string, unknown>))
    : [];

  const unverifiedFactors = Array.isArray(factors?.all)
    ? factors.all
        .filter((factor) => factor.status !== "verified")
        .map((factor) => toFactor(factor as unknown as Record<string, unknown>))
    : [];

  const currentLevel = levels?.currentLevel ?? null;
  const nextLevel = levels?.nextLevel ?? null;

  return {
    required: true,
    currentLevel,
    nextLevel,
    verifiedFactors,
    unverifiedFactors,
    needsEnrollment: verifiedFactors.length === 0,
    needsVerification: verifiedFactors.length > 0 && currentLevel !== "aal2",
  };
};

export const startAdminMfaEnrollment = async (
  friendlyName = "Tender Flow Admin TOTP",
): Promise<AdminMfaEnrollment> => {
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

  if (factorsError) throw factorsError;

  const matchingUnverifiedTotpFactors = Array.isArray(factors?.all)
    ? factors.all.filter(
        (factor) =>
          factor.factor_type === "totp" &&
          factor.status !== "verified" &&
          (factor.friendly_name || friendlyName) === friendlyName,
      )
    : [];

  for (const factor of matchingUnverifiedTotpFactors) {
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: factor.id,
    });
    if (unenrollError) throw unenrollError;
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
    issuer: "Tender Flow",
  });

  if (error) throw error;

  return {
    factorId: data.id,
    qrCodeSvg: data.totp.qr_code,
    secret: data.totp.secret,
    friendlyName: data.friendly_name || friendlyName,
  };
};

export const verifyAdminMfaEnrollment = async (input: {
  factorId: string;
  code: string;
}): Promise<void> => {
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
};

export const elevateAdminMfaSession = async (input: {
  factorId: string;
  code: string;
}): Promise<void> => {
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: input.factorId,
    code: input.code.trim(),
  });

  if (error) throw error;
};
