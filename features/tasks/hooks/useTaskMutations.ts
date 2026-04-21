import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import {
  createTask,
  deleteTask,
  setTaskCompleted,
  updateTask,
} from "../api/tasksApi";
import type { Task, TaskCreateInput, TaskUpdateInput } from "../types";
import { TASK_KEYS } from "./useTasksQuery";

const invalidateTaskLists = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
};

export const useCreateTaskMutation = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<Task, Error, TaskCreateInput>({
    mutationFn: (input) => {
      if (!user?.id) throw new Error("Uživatel není přihlášen");
      return createTask(user.id, input);
    },
    onSuccess: () => invalidateTaskLists(queryClient),
  });
};

export const useUpdateTaskMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, { id: string; input: TaskUpdateInput }>({
    mutationFn: ({ id, input }) => updateTask(id, input),
    onSuccess: () => invalidateTaskLists(queryClient),
  });
};

export const useDeleteTaskMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteTask(id),
    onSuccess: () => invalidateTaskLists(queryClient),
  });
};

export const useToggleTaskMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, { id: string; completed: boolean }>({
    mutationFn: ({ id, completed }) => setTaskCompleted(id, completed),
    onSuccess: () => invalidateTaskLists(queryClient),
  });
};
