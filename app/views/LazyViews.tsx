import React from "react";
import { DashboardSkeleton, ProjectLayoutSkeleton } from "@/shared/ui/SkeletonLoader";
import { getFeatureModuleManifest } from "@app/featureRegistry";

const lazyFromManifest = (view: Parameters<typeof getFeatureModuleManifest>[0]) =>
  React.lazy(() => getFeatureModuleManifest(view).mount());

export const ProjectManager = lazyFromManifest("project-management");

export const CommandCenterView = lazyFromManifest("command-center");

export const ProjectLayout = lazyFromManifest("project");

export const Contacts = lazyFromManifest("contacts");

export const Settings = lazyFromManifest("settings");

export const ProjectOverview = lazyFromManifest("project-overview");

export const UrlShortener = lazyFromManifest("url-shortener");

export const AppLazyFallback: React.FC = () => {
  return (
    <div className="h-full w-full p-8">
      <DashboardSkeleton />
      <ProjectLayoutSkeleton />
    </div>
  );
};
