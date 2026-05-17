import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { listTodoProjects } from "../api/taskProjectsApi";

export const TODO_PROJECT_KEYS = {
  all: ["todo-projects"] as const,
  list: (userId: string | undefined) => [...TODO_PROJECT_KEYS.all, "list", userId ?? "anon"] as const,
};

export const useTaskProjectsQuery = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: TODO_PROJECT_KEYS.list(user?.id),
    enabled: !!user && user.role !== "demo",
    queryFn: () => listTodoProjects(user!.id),
    staleTime: 60 * 1000,
  });
};
