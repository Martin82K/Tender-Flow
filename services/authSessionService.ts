import {
  clearStoredSessionData,
  getStoredAuthSessionRaw,
  setRememberMePreference,
  supabase,
} from "./supabase";
import { platformAdapter } from "./platformAdapter";
import { navigate } from "../shared/routing/router";
import { summarizeErrorForLog } from "../shared/security/logSanitizer";

export type AuthInvalidationReason =
  | "invalid_refresh_token"
  | "auth_fetch_errors"
  | "manual_logout"
  | "stuck_loading";

interface InvalidateAuthStateOptions {
  navigateToLogin?: boolean;
  reason?: AuthInvalidationReason;
}

let invalidateInFlight: Promise<void> | null = null;
let lastInvalidationAt = 0;
let lastNavigateToLoginAt = 0;

const INVALIDATE_COOLDOWN_MS = 3000;
const NAVIGATE_COOLDOWN_MS = 1000;

const navigateToLoginWithCooldown = (): void => {
  const now = Date.now();
  if (now - lastNavigateToLoginAt < NAVIGATE_COOLDOWN_MS) return;
  lastNavigateToLoginAt = now;
  try {
    navigate("/login", { replace: true });
  } catch {
    // ignore navigation failures in background cleanup path
  }
};

export const authSessionService = {
  clearStoredSessionData,
  getStoredAuthSessionRaw,
  setRememberMePreference,
  refreshSession: async (refreshToken: string) =>
    supabase.auth.refreshSession({ refresh_token: refreshToken }),
  getSession: async () => supabase.auth.getSession(),
  invalidateAuthState: async ({
    navigateToLogin = true,
    reason,
  }: InvalidateAuthStateOptions = {}): Promise<void> => {
    const now = Date.now();

    if (invalidateInFlight) {
      await invalidateInFlight;
      if (navigateToLogin) navigateToLoginWithCooldown();
      return;
    }

    if (now - lastInvalidationAt < INVALIDATE_COOLDOWN_MS) {
      if (navigateToLogin) navigateToLoginWithCooldown();
      return;
    }

    lastInvalidationAt = now;

    invalidateInFlight = (async () => {
      try {
        clearStoredSessionData();
      } catch (error) {
        console.warn("[authSessionService] Failed to clear local session:", summarizeErrorForLog(error));
      }

      try {
        await platformAdapter.session.clearCredentials();
      } catch (error) {
        console.warn("[authSessionService] Failed to clear secure credentials:", summarizeErrorForLog(error));
      }

      if (reason) {
        console.warn("[authSessionService] Auth state invalidated:", reason);
      }

      if (navigateToLogin) {
        navigateToLoginWithCooldown();
      }
    })();

    try {
      await invalidateInFlight;
    } finally {
      invalidateInFlight = null;
    }
  },
};
