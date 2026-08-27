import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "@shared/auth/AuthIdentityContext";

const state = vi.hoisted(() => ({
  identity: {
    id: "user-1",
    email: "user@example.com",
    role: "user",
  } as AuthIdentity | null,
  queryClient: { invalidateQueries: vi.fn() },
  getTodoStatus: vi.fn(),
  runMicrosoftTodoSync: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => state.queryClient,
}));

vi.mock("@shared/auth/AuthIdentityContext", () => ({
  useAuthIdentity: () => state.identity,
}));

vi.mock("@/infra/auth/microsoftAccountService", () => ({
  microsoftAccountService: {
    getTodoStatus: state.getTodoStatus,
  },
}));

vi.mock("@features/tasks/api/microsoftTodoSyncApi", () => ({
  runMicrosoftTodoSync: state.runMicrosoftTodoSync,
}));

import { TASK_KEYS } from "@features/tasks/hooks/useTasksQuery";
import { TODO_PROJECT_KEYS } from "@features/tasks/hooks/useTaskProjectsQuery";
import { useMicrosoftTodoSync } from "@features/tasks/hooks/useMicrosoftTodoSync";

describe("useMicrosoftTodoSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.identity = {
      id: "user-1",
      email: "user@example.com",
      role: "user",
    };
    state.getTodoStatus.mockResolvedValue({
      connected: true,
      lastSyncedAt: null,
      syncError: null,
    });
    state.runMicrosoftTodoSync.mockResolvedValue({ connected: true, pushed: 1 });
    state.queryClient.invalidateQueries.mockResolvedValue(undefined);
  });

  it("po načtení připojeného účtu synchronizuje a invaliduje oba task cache scopes", async () => {
    const { result, unmount } = renderHook(() => useMicrosoftTodoSync());

    await waitFor(() => expect(state.runMicrosoftTodoSync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.isSyncing).toBe(false));
    expect(result.current.connected).toBe(true);
    expect(state.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: TASK_KEYS.all });
    expect(state.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: TODO_PROJECT_KEYS.all });
    unmount();
  });

  it("pro nepřipojený účet nevolá synchronizační endpoint", async () => {
    state.getTodoStatus.mockResolvedValue({
      connected: false,
      lastSyncedAt: null,
      syncError: null,
    });
    const { result, unmount } = renderHook(() => useMicrosoftTodoSync());

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.connected).toBe(false);
    expect(state.runMicrosoftTodoSync).not.toHaveBeenCalled();
    unmount();
  });

  it("v demo režimu selže uzavřeně bez dotazu na stav účtu", async () => {
    state.identity = {
      id: "demo-user",
      email: "demo@example.com",
      role: "demo",
    };
    const { result, unmount } = renderHook(() => useMicrosoftTodoSync());

    await act(async () => undefined);
    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(state.getTodoStatus).not.toHaveBeenCalled();
    expect(state.runMicrosoftTodoSync).not.toHaveBeenCalled();
    unmount();
  });
});
