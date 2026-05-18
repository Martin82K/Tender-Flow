import {
  mfaService,
  type MfaEnrollment,
  type MfaFactor,
  type MfaStatus,
} from "@/infra/auth/mfaService";
import type { User } from "@/types";

export type AdminMfaFactor = MfaFactor;

export interface AdminMfaStatus extends Omit<MfaStatus, "factors" | "hasVerifiedFactor"> {
  required: boolean;
  needsEnrollment: boolean;
}

export type AdminMfaEnrollment = MfaEnrollment;

const defaultStatus: AdminMfaStatus = {
  required: false,
  currentLevel: null,
  nextLevel: null,
  verifiedFactors: [],
  unverifiedFactors: [],
  needsEnrollment: false,
  needsVerification: false,
};

export const getAdminMfaStatus = async (
  user: Pick<User, "role"> | null | undefined,
): Promise<AdminMfaStatus> => {
  if (!user || user.role !== "admin") return defaultStatus;

  const status = await mfaService.getStatus();

  return {
    required: true,
    currentLevel: status.currentLevel,
    nextLevel: status.nextLevel,
    verifiedFactors: status.verifiedFactors,
    unverifiedFactors: status.unverifiedFactors,
    needsEnrollment: status.verifiedFactors.length === 0,
    needsVerification: status.needsVerification,
  };
};

export const startAdminMfaEnrollment = async (
  friendlyName = "Tender Flow Admin TOTP",
): Promise<AdminMfaEnrollment> => {
  return mfaService.startTotpEnrollment(friendlyName);
};

export const verifyAdminMfaEnrollment = async (input: {
  factorId: string;
  code: string;
}): Promise<void> => {
  await mfaService.verifyEnrollment(input);
};

export const elevateAdminMfaSession = async (input: {
  factorId: string;
  code: string;
}): Promise<void> => {
  await mfaService.verifyFactor(input);
};
