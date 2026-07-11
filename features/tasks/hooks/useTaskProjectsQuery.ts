import { useQuery } from "@tanstack/react-query";
import type { AuthIdentity } from "@shared/auth/AuthIdentityContext";
import { listTodoProjects } from "../api/taskProjectsApi";

export const TODO_PROJECT_KEYS = {
  all: ["todo-projects"] as const,
  list: (userId: string | undefined) => [...TODO_PROJECT_KEYS.all, "list", userId ?? "anon"] as const,
};

interface UseTaskProjectsQueryInput {
  user: AuthIdentity | null;
}

export const useTaskProjectsQuery = ({ user }: UseTaskProjectsQueryInput) => {
  return useQuery({
    queryKey: TODO_PROJECT_KEYS.list(user?.id),
    enabled: !!user && user.role !== "demo",
    queryFn: () => {
      if (!user || user.role === "demo") return Promise.resolve([]);
      return listTodoProjects(user.id);
    },
    staleTime: 60 * 1000,
  });
};
