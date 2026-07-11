import { DEMO_PROJECT, getDemoData, saveDemoData } from "@/services/demoData";

export const projectDemoDataApi = {
  getDemoData,
  getProjects: () => {
    const projects = getDemoData()?.projects;
    return projects && projects.length > 0 ? projects : [DEMO_PROJECT];
  },
  saveDemoData,
};
