import type { DocHubProviderSettings, ProjectDetails } from "@/types";
import { normalizeDocHubOnlineUrl } from "./personalLocation";

export type DocHubCloudProvider = "gdrive" | "onedrive";

export interface DocHubCloudConnection {
  provider: DocHubCloudProvider;
  rootId: string;
  driveId: string | null;
  rootWebUrl: string | null;
}

const asCloudConnection = (
  provider: DocHubCloudProvider,
  settings: DocHubProviderSettings | null | undefined,
): DocHubCloudConnection | null => {
  const rootId = settings?.rootId?.trim();
  if (!rootId || rootId.startsWith("local:")) return null;

  return {
    provider,
    rootId,
    driveId: settings?.driveId?.trim() || null,
    rootWebUrl: normalizeDocHubOnlineUrl(
      settings?.rootWebUrl || settings?.rootLink || "",
    ),
  };
};

export const getDocHubCloudConnection = (
  project: Pick<
    ProjectDetails,
    | "docHubProvider"
    | "docHubRootId"
    | "docHubRootLink"
    | "docHubRootWebUrl"
    | "docHubDriveId"
    | "docHubSettings"
  >,
): DocHubCloudConnection | null => {
  const activeSettings: DocHubProviderSettings = {
    rootId: project.docHubRootId || undefined,
    rootLink: project.docHubRootLink || undefined,
    rootWebUrl: project.docHubRootWebUrl || undefined,
    driveId: project.docHubDriveId || undefined,
  };

  if (project.docHubProvider === "gdrive") {
    return asCloudConnection("gdrive", activeSettings);
  }
  if (project.docHubProvider === "onedrive_cloud") {
    return asCloudConnection("onedrive", activeSettings);
  }
  if (
    project.docHubProvider === "onedrive" &&
    project.docHubRootId &&
    !project.docHubRootId.startsWith("local:") &&
    normalizeDocHubOnlineUrl(project.docHubRootWebUrl || project.docHubRootLink || "")
  ) {
    return asCloudConnection("onedrive", activeSettings);
  }

  return asCloudConnection("gdrive", project.docHubSettings?.gdrive) ||
    asCloudConnection("onedrive", project.docHubSettings?.onedrive_cloud);
};

export const hasDocHubOnlineFallback = (
  project: Pick<ProjectDetails, "docHubRootWebUrl" | "docHubSettings" | "docHubProvider" | "docHubRootId" | "docHubRootLink" | "docHubDriveId">,
): boolean => Boolean(
  getDocHubCloudConnection(project) ||
  normalizeDocHubOnlineUrl(project.docHubRootWebUrl || ""),
);

export const snapshotActiveCloudSettings = (
  project: Pick<ProjectDetails, "docHubProvider" | "docHubRootId" | "docHubRootLink" | "docHubRootName" | "docHubRootWebUrl" | "docHubDriveId" | "docHubSiteId">,
): { key: "gdrive" | "onedrive_cloud"; settings: DocHubProviderSettings } | null => {
  const connection = getDocHubCloudConnection({
    ...project,
    docHubSettings: null,
  });
  if (!connection) return null;

  return {
    key: connection.provider === "gdrive" ? "gdrive" : "onedrive_cloud",
    settings: {
      rootLink: project.docHubRootLink || undefined,
      rootName: project.docHubRootName || undefined,
      rootId: connection.rootId,
      driveId: connection.driveId || undefined,
      siteId: project.docHubSiteId || undefined,
      rootWebUrl: connection.rootWebUrl || undefined,
    },
  };
};
