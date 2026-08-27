import { invokeAuthedFunction } from "@infra/functions/functionsClient";

export interface MicrosoftTodoSyncResult {
  connected: boolean;
  busy?: boolean;
  pulled?: number;
  pushed?: number;
  deleted?: number;
  checklist?: number;
}

export const runMicrosoftTodoSync = (): Promise<MicrosoftTodoSyncResult> =>
  invokeAuthedFunction<MicrosoftTodoSyncResult>("microsoft-todo-sync", {
    body: {},
    timeoutMs: 90_000,
    retries: 1,
    idempotencyKey: crypto.randomUUID(),
  });
