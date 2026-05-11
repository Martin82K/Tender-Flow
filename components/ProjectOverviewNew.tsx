import React from "react";
import { useAuth } from "@/context/AuthContext";
import {
  ProjectOverviewNew as FeatureProjectOverviewNew,
  type ProjectOverviewProps,
} from "@/features/projects/ui/ProjectOverviewNew";

/**
 * Compatibility shim.
 * Project overview UI lives in the projects feature module.
 */
export const ProjectOverviewNew: React.FC<ProjectOverviewProps> = (props) => {
  const { user } = useAuth();

  return (
    <FeatureProjectOverviewNew
      {...props}
      currentUserId={props.currentUserId ?? user?.id}
    />
  );
};

export type { ProjectOverviewProps };
export default ProjectOverviewNew;
