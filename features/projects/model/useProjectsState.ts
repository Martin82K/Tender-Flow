import { useMemo } from "react";
import { useProjectsQuery } from "@features/projects/hooks/useProjectsQuery";
import { useAuthIdentity } from "@shared/auth/AuthIdentityContext";
import type { Project } from "@/types";

const EMPTY_PROJECTS: Project[] = [];

export interface ProjectsState {
  projects: Project[];
  isLoading: boolean;
  isError: boolean;
}

export const useProjectsState = (): ProjectsState => {
  const user = useAuthIdentity();
  const projectsQuery = useProjectsQuery({ user });
  const projects = projectsQuery.data ?? EMPTY_PROJECTS;

  return useMemo(
    () => ({
      projects,
      isLoading: projectsQuery.isLoading,
      isError: Boolean(projectsQuery.isError),
    }),
    [projects, projectsQuery.isError, projectsQuery.isLoading],
  );
};
