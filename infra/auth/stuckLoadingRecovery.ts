import { authSessionService } from "@/services/authSessionService";

export const clearAuthSessionForRecovery = async (): Promise<void> => {
  await authSessionService.invalidateAuthState({
    navigateToLogin: false,
    reason: "stuck_loading",
  });
};
