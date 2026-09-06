import { logRuntimeEvent } from "@infra/diagnostics/runtimeDiagnostics";

type FolderOperationStage =
  | "folder_exists"
  | "authenticate"
  | "open_in_explorer"
  | "grant_access"
  | "retry_open_in_explorer";

// Only fixed stage names, elapsed time and outcome enter local diagnostics.
// Never pass paths, session tokens, operation results or error messages here.
export async function measureFolderOperation<T extends boolean | void | { success: boolean }>(
  stage: FolderOperationStage,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  let outcome: "success" | "failure" | "error" = "error";
  try {
    const result = await operation();
    outcome = result === false || (typeof result === "object" && !result.success)
      ? "failure"
      : "success";
    return result;
  } finally {
    try {
      logRuntimeEvent("filesystem", "operation_timing", {
        stage,
        duration_ms: Math.max(0, Math.round(performance.now() - startedAt)),
        outcome,
      });
    } catch {
      // Diagnostics must not change the result of a filesystem operation.
    }
  }
}
