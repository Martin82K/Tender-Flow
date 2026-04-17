import React from "react";
import { Dashboard } from "@/features/projects/Dashboard";
import { CommandCenter } from "@features/dashboard/ui/CommandCenter";
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
  return (
    <div className="flex flex-col gap-6">
      <CommandCenter />
      <Dashboard {...props} />
    </div>
  );
};
