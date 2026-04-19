import React from "react";
import { Dashboard } from "@/features/projects/Dashboard";
import type { Project, ProjectDetails } from "@/types";

interface DashboardViewProps {
  projects: Project[];
  projectDetails: Record<string, ProjectDetails>;
  onUpdateProjectDetails?: (
    id: string,
    updates: Partial<ProjectDetails>,
  ) => void;
  onNavigateToProject?: (
    projectId: string,
    tab: string,
    categoryId?: string,
  ) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = (props) => {
  return <Dashboard {...props} />;
};
