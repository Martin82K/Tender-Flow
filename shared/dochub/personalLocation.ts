export const DOC_HUB_PROJECT_MARKER_FILENAME = ".tenderflow-project.json";

export interface DocHubPersonalLocation {
  version: 1;
  userId: string;
  projectId: string;
  rootPath: string;
  rootName: string;
  savedAt: string;
}

export interface DocHubProjectMarker {
  version: 1;
  projectId: string;
  createdAt: string;
}

export const buildDocHubPersonalLocationKey = (
  userId: string,
  projectId: string,
): string => `dochub:personal-location:v1:${encodeURIComponent(userId)}:${encodeURIComponent(projectId)}`;

export const parseDocHubPersonalLocation = (
  serialized: string | null,
  expectedUserId: string,
  expectedProjectId: string,
): DocHubPersonalLocation | null => {
  if (!serialized) return null;
  try {
    const value = JSON.parse(serialized) as Partial<DocHubPersonalLocation>;
    if (
      value.version !== 1 ||
      value.userId !== expectedUserId ||
      value.projectId !== expectedProjectId ||
      typeof value.rootPath !== "string" ||
      !value.rootPath.trim() ||
      typeof value.rootName !== "string" ||
      typeof value.savedAt !== "string"
    ) return null;
    return value as DocHubPersonalLocation;
  } catch {
    return null;
  }
};

export const resolveEffectiveLocalRoot = ({
  isProjectOwner,
  projectRootPath,
  personalRootPath,
}: {
  isProjectOwner: boolean;
  projectRootPath?: string | null;
  personalRootPath?: string | null;
}): string => personalRootPath?.trim() || (isProjectOwner ? projectRootPath?.trim() || "" : "");

export const resolveValidatedEffectiveLocalRoot = ({
  isProjectOwner,
  projectRootPath,
  personalRootPath,
  hadStoredLocation,
}: {
  isProjectOwner: boolean;
  projectRootPath?: string | null;
  personalRootPath?: string | null;
  hadStoredLocation: boolean;
}): string => {
  if (hadStoredLocation && !personalRootPath?.trim()) return "";
  return resolveEffectiveLocalRoot({ isProjectOwner, projectRootPath, personalRootPath });
};

export const createDocHubProjectMarker = (
  projectId: string,
  createdAt = new Date().toISOString(),
): string => JSON.stringify({ version: 1, projectId, createdAt } satisfies DocHubProjectMarker, null, 2);

export const parseDocHubProjectMarker = (
  serialized: string,
  expectedProjectId: string,
): DocHubProjectMarker | null => {
  const value = parseDocHubProjectMarkerValue(serialized);
  return value?.projectId === expectedProjectId ? value : null;
};

export const parseDocHubProjectMarkerValue = (
  serialized: string,
): DocHubProjectMarker | null => {
  try {
    const value = JSON.parse(serialized) as Partial<DocHubProjectMarker>;
    if (
      value.version !== 1 ||
      typeof value.projectId !== "string" ||
      !value.projectId.trim() ||
      typeof value.createdAt !== "string" ||
      !value.createdAt.trim()
    ) return null;
    return value as DocHubProjectMarker;
  } catch {
    return null;
  }
};

export const isDocHubProjectMarkerForDifferentProject = (
  marker: DocHubProjectMarker | null,
  expectedProjectId: string,
): boolean => marker !== null && marker.projectId !== expectedProjectId;

export const validateDocHubPersonalLocation = async (
  location: DocHubPersonalLocation | null,
  expectedProjectId: string,
  dependencies: {
    folderExists: (rootPath: string) => Promise<boolean>;
    readMarker: (markerPath: string) => Promise<string>;
  },
): Promise<DocHubPersonalLocation | null> => {
  if (!location || location.projectId !== expectedProjectId) return null;
  if (!(await dependencies.folderExists(location.rootPath))) return null;

  try {
    const markerPath = joinDocHubPath(location.rootPath, DOC_HUB_PROJECT_MARKER_FILENAME);
    const marker = parseDocHubProjectMarkerValue(await dependencies.readMarker(markerPath));
    return marker?.projectId === expectedProjectId ? location : null;
  } catch {
    return null;
  }
};

export const joinDocHubPath = (rootPath: string, name: string): string => {
  const separator = rootPath.includes("\\") ? "\\" : "/";
  return `${rootPath.replace(/[\\/]+$/, "")}${separator}${name}`;
};

export const normalizeDocHubOnlineUrl = (value: string): string | null => {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    const allowed = host === "drive.google.com" ||
      host === "onedrive.live.com" ||
      host === "1drv.ms" ||
      host.endsWith(".sharepoint.com");
    if (url.protocol !== "https:" || url.username || url.password || !allowed) return null;
    return url.toString();
  } catch {
    return null;
  }
};
