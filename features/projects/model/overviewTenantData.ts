import type { Project, ProjectDetails } from "@/types";

export interface OverviewTenantData {
  projects: Project[];
  projectDetails: Record<string, ProjectDetails>;
}

const createEmptyOverviewTenantData = (): OverviewTenantData => ({
  projects: [],
  projectDetails: {},
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isProject = (value: unknown): value is Project =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string";

const isProjectDetails = (value: unknown): value is ProjectDetails =>
  isRecord(value) &&
  typeof value.title === "string" &&
  Array.isArray(value.categories);

export const normalizeOverviewTenantData = (
  payload: unknown,
): OverviewTenantData => {
  if (!isRecord(payload)) {
    return createEmptyOverviewTenantData();
  }

  const projects = Array.isArray(payload.projects)
    ? payload.projects.filter(isProject)
    : [];
  const projectDetails = isRecord(payload.projectDetails)
    ? (Object.fromEntries(
        Object.entries(payload.projectDetails).filter(
          ([projectId, details]) => projectId.length > 0 && isProjectDetails(details),
        ),
      ) as Record<string, ProjectDetails>)
    : {};

  return { projects, projectDetails };
};
