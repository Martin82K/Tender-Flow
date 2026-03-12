export type CookieConsentDecision = "accepted_all" | "essential_only";

const COOKIE_CONSENT_KEY = "tf_cookie_consent_v1";

export const getCookieConsentDecision = (): CookieConsentDecision | null => {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);
  if (value === "accepted_all" || value === "essential_only") return value;
  return null;
};

export const setCookieConsentDecision = (decision: CookieConsentDecision): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COOKIE_CONSENT_KEY, decision);
};

export const clearCookieConsentDecision = (): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(COOKIE_CONSENT_KEY);
};
