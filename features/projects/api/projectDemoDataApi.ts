import {
  DEMO_PROJECT,
  DEMO_PROJECT_DETAILS,
  getDemoData,
  isDemoSession,
  saveDemoData,
} from "@/services/demoData";
import type { ProjectDetails } from "@/types";

export const projectDemoDataApi = {
  getDemoData,
  getProjects: () => {
    const projects = getDemoData()?.projects;
    return projects && projects.length > 0 ? projects : [DEMO_PROJECT];
  },
  getProjectDetails: (projectId: string): ProjectDetails => {
    const details = getDemoData()?.projectDetails?.[projectId] as
      | ProjectDetails
      | undefined;
    return details ?? DEMO_PROJECT_DETAILS;
  },
  isDemoProjectId: (projectId: string): boolean => projectId === DEMO_PROJECT.id,
  isDemoSession,
  saveDemoData,
};
