import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "@shared/auth/AuthIdentityContext";
import type { TaskFilter } from "@features/tasks/types";

type QueryOptions = {
  queryKey: readonly unknown[];
  enabled: boolean;
  queryFn: () => Promise<unknown>;
  staleTime: number;
};

const state = vi.hoisted(() => ({
  options: [] as QueryOptions[],
  legacyUseAuth: vi.fn(),
  listTasks: vi.fn(),
  listTodoProjects: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: QueryOptions) => {
    state.options.push(options);
    return { data: undefined, isLoading: true, isError: false };
  },
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: state.legacyUseAuth,
}));

vi.mock("@features/tasks/api/tasksApi", () => ({
  listTasks: state.listTasks,
}));

vi.mock("@features/tasks/api/taskProjectsApi", () => ({
  listTodoProjects: state.listTodoProjects,
}));

import {
  TASK_KEYS,
  useTasksQuery,
} from "@features/tasks/hooks/useTasksQuery";
import {
  TODO_PROJECT_KEYS,
  useTaskProjectsQuery,
} from "@features/tasks/hooks/useTaskProjectsQuery";

const explicitUser: AuthIdentity = {
  id: "explicit-user",
  email: "explicit@example.com",
  role: "admin",
};

describe("task query auth boundary", () => {
  beforeEach(() => {
    state.options = [];
    state.legacyUseAuth.mockReset();
    state.legacyUseAuth.mockReturnValue({
      user: {
        id: "legacy-user",
        email: "legacy@example.com",
        role: "user",
      },
    });
    state.listTasks.mockReset();
    state.listTasks.mockResolvedValue([{ id: "task-1" }]);
    state.listTodoProjects.mockReset();
    state.listTodoProjects.mockResolvedValue([{ id: "todo-project-1" }]);
  });

  it("scopes the task list and filter to the explicitly supplied identity", async () => {
    const filter: TaskFilter = { completed: false, includeArchived: true };

    renderHook(() => useTasksQuery({ user: explicitUser, filter }));

    const options = state.options[0];
    expect(options.queryKey).toEqual(TASK_KEYS.list("explicit-user", filter));
    expect(options.enabled).toBe(true);
    expect(options.staleTime).toBe(60 * 1000);
    await expect(options.queryFn()).resolves.toEqual([{ id: "task-1" }]);
    expect(state.listTasks).toHaveBeenCalledWith("explicit-user", filter);
    expect(state.legacyUseAuth).not.toHaveBeenCalled();
  });

  it("scopes todo projects to the explicitly supplied identity", async () => {
    renderHook(() => useTaskProjectsQuery({ user: explicitUser }));

    const options = state.options[0];
    expect(options.queryKey).toEqual(TODO_PROJECT_KEYS.list("explicit-user"));
    expect(options.enabled).toBe(true);
    expect(options.staleTime).toBe(60 * 1000);
    await expect(options.queryFn()).resolves.toEqual([{ id: "todo-project-1" }]);
    expect(state.listTodoProjects).toHaveBeenCalledWith("explicit-user");
    expect(state.legacyUseAuth).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    [
      "demo",
      {
        id: "demo-user",
        email: "demo@example.com",
        role: "demo",
      } satisfies AuthIdentity,
    ],
  ])("fails closed for %s identity", async (_label, user) => {
    renderHook(() => useTasksQuery({ user, filter: { completed: false } }));
    renderHook(() => useTaskProjectsQuery({ user }));

    expect(state.options).toHaveLength(2);
    for (const options of state.options) {
      expect(options.enabled).toBe(false);
      await expect(options.queryFn()).resolves.toEqual([]);
    }
    expect(state.listTasks).not.toHaveBeenCalled();
    expect(state.listTodoProjects).not.toHaveBeenCalled();
    expect(state.legacyUseAuth).not.toHaveBeenCalled();
  });
});
