import React from "react";
import { DashboardSkeleton, ProjectLayoutSkeleton } from "@/shared/ui/SkeletonLoader";

export const ProjectManager = React.lazy(() =>
  import("@/features/projects/ProjectManager").then((m) => ({
    default: m.ProjectManager,
  })),
);

export const Dashboard = React.lazy(() =>
  import("@/features/projects/Dashboard").then((m) => ({ default: m.Dashboard })),
);

export const ProjectLayout = React.lazy(() =>
  import("@/features/projects/ProjectLayout").then((m) => ({
    default: m.ProjectLayout,
  })),
);

export const Contacts = React.lazy(() =>
  import("@/features/contacts/Contacts").then((m) => ({ default: m.Contacts })),
);

export const Settings = React.lazy(() =>
  import("@/components/Settings").then((m) => ({ default: m.Settings })),
);

export const ProjectOverview = React.lazy(() =>
  import("@/features/projects/ProjectOverview").then((m) => ({
    default: m.ProjectOverview,
  })),
);

export const UrlShortener = React.lazy(() =>
  import("@/features/tools/UrlShortener").then((m) => ({
    default: m.UrlShortener,
  })),
);

export const AppLazyFallback: React.FC = () => {
  return (
    <div className="h-full w-full p-8">
      <DashboardSkeleton />
      <ProjectLayoutSkeleton />
    </div>
  );
};
