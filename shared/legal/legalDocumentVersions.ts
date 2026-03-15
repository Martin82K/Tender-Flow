import type { LegalAcceptance, LegalAcceptanceInput, User } from "@/types";

export const CURRENT_TERMS_VERSION = "2026-03-12";
export const CURRENT_PRIVACY_VERSION = "2026-03-15";

export const CURRENT_TERMS_UPDATED_AT_LABEL = "12. března 2026";
export const CURRENT_PRIVACY_UPDATED_AT_LABEL = "15. března 2026";

export const getCurrentLegalAcceptanceInput = (): LegalAcceptanceInput => ({
  termsVersion: CURRENT_TERMS_VERSION,
  privacyVersion: CURRENT_PRIVACY_VERSION,
});

export const hasAcceptedCurrentLegalDocuments = (
  legalAcceptance?: LegalAcceptance | null,
): boolean => {
  if (!legalAcceptance) return false;

  return (
    legalAcceptance.termsVersion === CURRENT_TERMS_VERSION &&
    typeof legalAcceptance.termsAcceptedAt === "string" &&
    legalAcceptance.termsAcceptedAt.length > 0 &&
    legalAcceptance.privacyVersion === CURRENT_PRIVACY_VERSION &&
    typeof legalAcceptance.privacyAcceptedAt === "string" &&
    legalAcceptance.privacyAcceptedAt.length > 0
  );
};

export const requiresLegalAcceptance = (user?: User | null): boolean => {
  if (!user || user.role === "demo") return false;
  return !hasAcceptedCurrentLegalDocuments(user.legalAcceptance);
};
