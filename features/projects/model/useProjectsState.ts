import { useMemo } from "react";
import { useProjectsQuery } from "@/hooks/queries/useProjectsQuery";
import type { Project } from "@/types";

const EMPTY_PROJECTS: Project[] = [];

export interface ProjectsState {
  projects: Project[];
  isLoading: boolean;
  isError: boolean;
}

export const useProjectsState = (): ProjectsState => {
  const projectsQuery = useProjectsQuery();
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
