import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import {
  createTodoProject,
  deleteTodoProject,
  updateTodoProject,
} from "../api/taskProjectsApi";
import type {
  TodoProject,
  TodoProjectCreateInput,
  TodoProjectUpdateInput,
} from "../types";
import { TODO_PROJECT_KEYS } from "./useTaskProjectsQuery";
import { TASK_KEYS } from "./useTasksQuery";

const invalidateTodoProjects = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: TODO_PROJECT_KEYS.all });
};

export const useCreateTodoProjectMutation = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<TodoProject, Error, TodoProjectCreateInput>({
    mutationFn: (input) => {
      if (!user?.id) throw new Error("Uživatel není přihlášen");
      return createTodoProject(user.id, input);
    },
    onSuccess: () => invalidateTodoProjects(queryClient),
  });
};

export const useUpdateTodoProjectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<TodoProject, Error, { id: string; input: TodoProjectUpdateInput }>({
    mutationFn: ({ id, input }) => updateTodoProject(id, input),
    onSuccess: () => invalidateTodoProjects(queryClient),
  });
};

export const useDeleteTodoProjectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteTodoProject(id),
    onSuccess: () => {
      invalidateTodoProjects(queryClient);
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
    },
  });
};
