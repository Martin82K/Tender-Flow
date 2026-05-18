import { invokeAuthedFunction } from "@/services/functionsClient";

export interface AdminResetMfaResult {
  success: boolean;
  deletedFactors: number;
}

export const resetUserMfaAdmin = async (input: {
  userId: string;
  confirmationEmail: string;
}): Promise<AdminResetMfaResult> =>
  invokeAuthedFunction<AdminResetMfaResult>("admin-reset-mfa", {
    body: input,
    timeoutMs: 20_000,
  });
