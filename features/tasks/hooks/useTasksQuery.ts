import { useQuery } from "@tanstack/react-query";
import type { AuthIdentity } from "@shared/auth/AuthIdentityContext";
import { listTasks } from "../api/tasksApi";
import type { TaskFilter } from "../types";

export const TASK_KEYS = {
  all: ["tasks"] as const,
  list: (userId: string | undefined, filter?: TaskFilter) =>
    [...TASK_KEYS.all, "list", userId ?? "anon", filter ?? {}] as const,
};

interface UseTasksQueryInput {
  user: AuthIdentity | null;
  filter?: TaskFilter;
}

export const useTasksQuery = ({ user, filter }: UseTasksQueryInput) => {
  return useQuery({
    queryKey: TASK_KEYS.list(user?.id, filter),
    enabled: !!user && user.role !== "demo",
    queryFn: () => {
      if (!user || user.role === "demo") return Promise.resolve([]);
      return listTasks(user.id, filter);
    },
    staleTime: 60 * 1000,
  });
};
