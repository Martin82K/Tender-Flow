import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { listTasks } from "../api/tasksApi";
import type { TaskFilter } from "../types";

export const TASK_KEYS = {
  all: ["tasks"] as const,
  list: (userId: string | undefined, filter?: TaskFilter) =>
    [...TASK_KEYS.all, "list", userId ?? "anon", filter ?? {}] as const,
};

export const useTasksQuery = (filter?: TaskFilter) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: TASK_KEYS.list(user?.id, filter),
    enabled: !!user && user.role !== "demo",
    queryFn: () => listTasks(user!.id, filter),
    staleTime: 60 * 1000,
  });
};
