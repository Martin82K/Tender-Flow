import type { DocHubProviderSettings, ProjectDetails } from "@/types";
import { normalizeDocHubOnlineUrl } from "./personalLocation";

export type DocHubCloudProvider = "gdrive" | "onedrive";

export interface DocHubCloudConnection {
  provider: DocHubCloudProvider;
  rootId: string;
  driveId: string | null;
  rootWebUrl: string | null;
}

const CLOUD_SETTINGS_KEYS = ["gdrive", "onedrive_cloud"] as const;
const LOCAL_SETTINGS_KEYS = ["onedrive", "local"] as const;

const sanitizeDisplayName = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.includes("/") || trimmed.includes("\\")) return undefined;
  return trimmed;
};

const sanitizeOpaqueId = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  if (
    !trimmed ||
    trimmed.startsWith("local:") ||
    trimmed.includes("/") ||
    trimmed.includes("\\")
  ) {
    return undefined;
  }
  return trimmed;
};

export const sanitizeDocHubSettings = (
  settings: ProjectDetails["docHubSettings"],
): NonNullable<ProjectDetails["docHubSettings"]> => {
  const sanitized: NonNullable<ProjectDetails["docHubSettings"]> = {};

  for (const key of CLOUD_SETTINGS_KEYS) {
    const current = settings?.[key];
    if (!current) continue;
    const onlineUrl = normalizeDocHubOnlineUrl(
      current.rootWebUrl || current.rootLink || "",
    );
    const next: DocHubProviderSettings = {
      rootLink: onlineUrl || undefined,
      rootName: sanitizeDisplayName(current.rootName),
      rootId: sanitizeOpaqueId(current.rootId),
      driveId: sanitizeOpaqueId(current.driveId),
      siteId: sanitizeOpaqueId(current.siteId),
      rootWebUrl: onlineUrl || undefined,
    };
    if (Object.values(next).some(Boolean)) sanitized[key] = next;
  }

  for (const key of LOCAL_SETTINGS_KEYS) {
    const current = settings?.[key];
    if (!current) continue;
    const next: DocHubProviderSettings = {
      rootName: sanitizeDisplayName(current.rootName),
      rootWebUrl: normalizeDocHubOnlineUrl(current.rootWebUrl || "") || undefined,
    };
    if (Object.values(next).some(Boolean)) sanitized[key] = next;
  }

  return sanitized;
};

export const replaceDocHubCloudFallbackUrl = (
  settings: ProjectDetails["docHubSettings"],
  onlineUrl: string | null,
): NonNullable<ProjectDetails["docHubSettings"]> => {
  const next = sanitizeDocHubSettings(settings);
  delete next.gdrive;
  delete next.onedrive_cloud;

  if (!onlineUrl) return next;
  const hostname = new URL(onlineUrl).hostname.toLowerCase();
  const key = hostname === "drive.google.com" ? "gdrive" : "onedrive_cloud";
  next[key] = { rootLink: onlineUrl, rootWebUrl: onlineUrl };
  return next;
};

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

export const canOpenProjectDocHub = (
  project: Pick<
    ProjectDetails,
    | "docHubEnabled"
    | "docHubStatus"
    | "docHubProvider"
    | "docHubRootWebUrl"
    | "docHubSettings"
    | "docHubRootId"
    | "docHubRootLink"
    | "docHubDriveId"
  >,
  effectiveRoot: string,
): boolean => Boolean(
  project.docHubEnabled &&
  project.docHubStatus !== "disconnected" &&
  project.docHubStatus !== "error" &&
  project.docHubProvider &&
  (effectiveRoot.trim() || hasDocHubOnlineFallback(project)),
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
