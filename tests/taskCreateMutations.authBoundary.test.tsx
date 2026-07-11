import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "@shared/auth/AuthIdentityContext";
import type {
  TaskCreateInput,
  TodoProjectCreateInput,
} from "@features/tasks/types";

type MutationOptions = {
  mutationFn: (input: unknown) => Promise<unknown>;
  onSuccess?: () => void;
};

const state = vi.hoisted(() => ({
  identity: null as AuthIdentity | null,
  legacyUseAuth: vi.fn(),
  mutationOptions: [] as MutationOptions[],
  invalidateQueries: vi.fn(),
  createTask: vi.fn(),
  createTodoProject: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: state.invalidateQueries }),
  useMutation: (options: MutationOptions) => {
    state.mutationOptions.push(options);
    return { mutateAsync: options.mutationFn, isPending: false };
  },
}));

vi.mock("@shared/auth/AuthIdentityContext", () => ({
  useAuthIdentity: () => state.identity,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: state.legacyUseAuth,
}));

vi.mock("@features/tasks/api/tasksApi", () => ({
  createTask: state.createTask,
  deleteTask: vi.fn(),
  setTaskCompleted: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock("@features/tasks/api/taskProjectsApi", () => ({
  createTodoProject: state.createTodoProject,
  deleteTodoProject: vi.fn(),
  updateTodoProject: vi.fn(),
}));

import { TASK_KEYS } from "@features/tasks/hooks/useTasksQuery";
import { TODO_PROJECT_KEYS } from "@features/tasks/hooks/useTaskProjectsQuery";
import { useCreateTaskMutation } from "@features/tasks/hooks/useTaskMutations";
import { useCreateTodoProjectMutation } from "@features/tasks/hooks/useTaskProjectMutations";

const explicitUser: AuthIdentity = {
  id: "explicit-user",
  email: "explicit@example.com",
  role: "user",
};

const invokeMutation = (index: number, input: unknown): Promise<unknown> =>
  Promise.resolve().then(() => state.mutationOptions[index].mutationFn(input));

describe("task create mutation auth boundary", () => {
  beforeEach(() => {
    state.identity = explicitUser;
    state.legacyUseAuth.mockReset();
    state.legacyUseAuth.mockReturnValue({
      user: {
        id: "legacy-user",
        email: "legacy@example.com",
        role: "user",
      },
    });
    state.mutationOptions = [];
    state.invalidateQueries.mockReset();
    state.createTask.mockReset();
    state.createTask.mockResolvedValue({ id: "task-1" });
    state.createTodoProject.mockReset();
    state.createTodoProject.mockResolvedValue({ id: "todo-project-1" });
  });

  it("creates a task for the shared identity and preserves its cache invalidation", async () => {
    const input: TaskCreateInput = { title: "Nový úkol", projectId: "project-1" };
    renderHook(() => useCreateTaskMutation());

    await expect(invokeMutation(0, input)).resolves.toEqual({ id: "task-1" });
    expect(state.createTask).toHaveBeenCalledWith("explicit-user", input);
    expect(state.legacyUseAuth).not.toHaveBeenCalled();

    state.mutationOptions[0].onSuccess?.();
    expect(state.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(state.invalidateQueries).toHaveBeenCalledWith({ queryKey: TASK_KEYS.all });
  });

  it("creates a TODO project for the shared identity and preserves its cache invalidation", async () => {
    const input: TodoProjectCreateInput = { name: "Osobní projekt", color: "#112233" };
    renderHook(() => useCreateTodoProjectMutation());

    await expect(invokeMutation(0, input)).resolves.toEqual({ id: "todo-project-1" });
    expect(state.createTodoProject).toHaveBeenCalledWith("explicit-user", input);
    expect(state.legacyUseAuth).not.toHaveBeenCalled();

    state.mutationOptions[0].onSuccess?.();
    expect(state.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(state.invalidateQueries).toHaveBeenCalledWith({
      queryKey: TODO_PROJECT_KEYS.all,
    });
  });

  it.each([
    [
      "missing",
      null,
      "TASK_MUTATION_AUTH_REQUIRED",
      "Pro vytvoření je nutné přihlášení.",
    ],
    [
      "demo",
      {
        id: "demo-user",
        email: "demo@example.com",
        role: "demo",
      } satisfies AuthIdentity,
      "TASK_MUTATION_DEMO_READ_ONLY",
      "Demo režim je pouze pro čtení.",
    ],
  ])("rejects task and TODO project creation for %s identity", async (_label, identity, code, message) => {
    state.identity = identity;
    renderHook(() => useCreateTaskMutation());
    renderHook(() => useCreateTodoProjectMutation());

    await expect(invokeMutation(0, { title: "Blokovaný úkol" })).rejects.toMatchObject({
      code,
      message,
    });
    await expect(invokeMutation(1, { name: "Blokovaný projekt" })).rejects.toMatchObject({
      code,
      message,
    });
    expect(state.createTask).not.toHaveBeenCalled();
    expect(state.createTodoProject).not.toHaveBeenCalled();
    expect(state.invalidateQueries).not.toHaveBeenCalled();
    expect(state.legacyUseAuth).not.toHaveBeenCalled();
  });

  it("propagates an API failure without success invalidation", async () => {
    const apiError = Object.assign(new Error("task insert failed"), {
      code: "TASK_INSERT_FAILED",
    });
    state.createTask.mockRejectedValue(apiError);
    renderHook(() => useCreateTaskMutation());

    await expect(invokeMutation(0, { title: "Selhávající úkol" })).rejects.toBe(apiError);
    expect(state.invalidateQueries).not.toHaveBeenCalled();
  });
});
