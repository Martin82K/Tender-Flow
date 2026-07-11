import { useMemo } from "react";
import { useAllProjectDetailsQuery } from "@features/projects/hooks/useProjectDetailsQuery";
import { useProjectsState } from "./useProjectsState";
import type { Project, ProjectDetails } from "@/types";

const EMPTY_PROJECT_DETAILS: Record<string, ProjectDetails> = {};

export interface ProjectPortfolioState {
  projects: Project[];
  allProjectDetails: Record<string, ProjectDetails>;
  isLoading: boolean;
  isError: boolean;
}

export const useProjectPortfolioState = (): ProjectPortfolioState => {
  const projectsState = useProjectsState();
  const { projects } = projectsState;
  const detailsQuery = useAllProjectDetailsQuery(projects);
  const allProjectDetails = detailsQuery.data ?? EMPTY_PROJECT_DETAILS;

  return useMemo(
    () => ({
      projects,
      allProjectDetails,
      isLoading: projectsState.isLoading || detailsQuery.isLoading,
      isError: projectsState.isError || Boolean(detailsQuery.isError),
    }),
    [
      allProjectDetails,
      detailsQuery.isError,
      detailsQuery.isLoading,
      projects,
      projectsState.isError,
      projectsState.isLoading,
    ],
  );
};
