import { useMemo } from "react";
import { useAllProjectDetailsQuery } from "@/hooks/queries/useProjectDetailsQuery";
import { useProjectsQuery } from "@/hooks/queries/useProjectsQuery";
import type { Project, ProjectDetails } from "@/types";

const EMPTY_PROJECTS: Project[] = [];
const EMPTY_PROJECT_DETAILS: Record<string, ProjectDetails> = {};

export interface ProjectPortfolioState {
  projects: Project[];
  allProjectDetails: Record<string, ProjectDetails>;
  isLoading: boolean;
  isError: boolean;
}

export const useProjectPortfolioState = (): ProjectPortfolioState => {
  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data ?? EMPTY_PROJECTS;
  const detailsQuery = useAllProjectDetailsQuery(projects);
  const allProjectDetails = detailsQuery.data ?? EMPTY_PROJECT_DETAILS;

  return useMemo(
    () => ({
      projects,
      allProjectDetails,
      isLoading: projectsQuery.isLoading || detailsQuery.isLoading,
      isError: Boolean(projectsQuery.isError || detailsQuery.isError),
    }),
    [
      allProjectDetails,
      detailsQuery.isError,
      detailsQuery.isLoading,
      projects,
      projectsQuery.isError,
      projectsQuery.isLoading,
    ],
  );
};
