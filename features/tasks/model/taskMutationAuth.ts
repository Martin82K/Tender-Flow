import type { AuthIdentity } from "@shared/auth/AuthIdentityContext";

export type TaskMutationAuthErrorCode =
  | "TASK_MUTATION_AUTH_REQUIRED"
  | "TASK_MUTATION_DEMO_READ_ONLY";

export class TaskMutationAuthError extends Error {
  readonly code: TaskMutationAuthErrorCode;

  constructor(code: TaskMutationAuthErrorCode, message: string) {
    super(message);
    this.name = "TaskMutationAuthError";
    this.code = code;
  }
}

export const requireTaskMutationUserId = (
  identity: AuthIdentity | null,
): string => {
  if (!identity) {
    throw new TaskMutationAuthError(
      "TASK_MUTATION_AUTH_REQUIRED",
      "Pro vytvoření je nutné přihlášení.",
    );
  }
  if (identity.role === "demo") {
    throw new TaskMutationAuthError(
      "TASK_MUTATION_DEMO_READ_ONLY",
      "Demo režim je pouze pro čtení.",
    );
  }
  return identity.id;
};
