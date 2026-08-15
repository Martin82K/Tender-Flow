export const DOC_HUB_PROJECT_MARKER_FILENAME = ".tenderflow-project.json";

export interface DocHubPersonalLocation {
  version: 2;
  userId: string;
  projectId: string;
  connectionId: string;
  rootPath: string;
  rootName: string;
  savedAt: string;
}

export interface DocHubProjectMarker {
  version: 2;
  projectId: string;
  connectionId: string;
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
      value.version !== 2 ||
      value.userId !== expectedUserId ||
      value.projectId !== expectedProjectId ||
      typeof value.connectionId !== "string" ||
      !value.connectionId.trim() ||
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
  connectionId: string,
  createdAt = new Date().toISOString(),
): string => JSON.stringify({ version: 2, projectId, connectionId, createdAt } satisfies DocHubProjectMarker, null, 2);

export const parseDocHubProjectMarker = (
  serialized: string,
  expectedProjectId: string,
  expectedConnectionId: string,
): DocHubProjectMarker | null => {
  const value = parseDocHubProjectMarkerValue(serialized);
  return value?.projectId === expectedProjectId && value.connectionId === expectedConnectionId
    ? value
    : null;
};

export const parseDocHubProjectMarkerValue = (
  serialized: string,
): DocHubProjectMarker | null => {
  try {
    const value = JSON.parse(serialized) as Partial<DocHubProjectMarker>;
    if (
      value.version !== 2 ||
      typeof value.projectId !== "string" ||
      !value.projectId.trim() ||
      typeof value.connectionId !== "string" ||
      !value.connectionId.trim() ||
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
  expectedConnectionId: string | null | undefined,
  dependencies: {
    folderExists: (rootPath: string) => Promise<boolean>;
    readMarker: (markerPath: string) => Promise<string>;
  },
): Promise<DocHubPersonalLocation | null> => {
  if (
    !location ||
    location.projectId !== expectedProjectId ||
    !expectedConnectionId ||
    location.connectionId !== expectedConnectionId
  ) return null;
  if (!(await dependencies.folderExists(location.rootPath))) return null;

  try {
    const markerPath = joinDocHubPath(location.rootPath, DOC_HUB_PROJECT_MARKER_FILENAME);
    const marker = parseDocHubProjectMarkerValue(await dependencies.readMarker(markerPath));
    if (!marker) return location;
    return marker?.projectId === expectedProjectId && marker.connectionId === expectedConnectionId
      ? location
      : null;
  } catch {
    return location;
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

export const isSharePointSharingUrl = (value: string | null | undefined): boolean => {
  const normalized = normalizeDocHubOnlineUrl(value || "");
  if (!normalized) return false;
  const url = new URL(normalized);
  return url.hostname.toLowerCase().endsWith(".sharepoint.com") &&
    /\/:[a-z]:\//i.test(url.pathname);
};

const BLOCKED_SHAREPOINT_QUERY_KEYS = new Set([
  "authkey",
  "id",
  "resid",
  "rootfolder",
  "sourcedoc",
]);

const isSafeSharePointPathSegment = (segment: string): boolean => Boolean(
  segment &&
  segment !== "." &&
  segment !== ".." &&
  !/[\u0000-\u001f\u007f]/.test(segment) &&
  !/%(?:2f|5c)/i.test(segment),
);

const hasUnsafePathSegment = (path: string): boolean => path
  .split("/")
  .some((segment) => segment === "." || segment === ".." || /[\\\u0000-\u001f\u007f]/.test(segment));

export const buildSharePointFolderUrl = (
  rootUrl: string | null | undefined,
  relativePath: string,
): string | null => {
  const normalizedRoot = normalizeDocHubOnlineUrl(rootUrl || "");
  if (!normalizedRoot) return null;

  const url = new URL(normalizedRoot);
  if (!url.hostname.toLowerCase().endsWith(".sharepoint.com")) return null;

  const lowerPath = url.pathname.toLowerCase();
  if (isSharePointSharingUrl(normalizedRoot)) return null;

  const trimmedPath = relativePath.trim().replace(/^[\\/]+|[\\/]+$/g, "");
  if (!trimmedPath) return null;
  const segments = trimmedPath.split(/[\\/]/).map((segment) => segment.trim());
  if (segments.some((segment) => !isSafeSharePointPathSegment(segment))) return null;

  if (lowerPath.endsWith("/_layouts/15/onedrive.aspx")) {
    if (url.searchParams.has("authkey")) return null;
    const rootItemPath = url.searchParams.get("id");
    if (
      !rootItemPath ||
      !rootItemPath.startsWith("/") ||
      hasUnsafePathSegment(rootItemPath)
    ) return null;

    const childItemPath = `${rootItemPath.replace(/\/+$/, "")}/${segments.join("/")}`;
    return `${url.origin}${url.pathname}?id=${encodeURIComponent(childItemPath)}`;
  }

  if (
    lowerPath.includes("/_layouts/") ||
    lowerPath.includes("/forms/") ||
    lowerPath.endsWith("/allitems.aspx")
  ) return null;

  for (const key of url.searchParams.keys()) {
    if (BLOCKED_SHAREPOINT_QUERY_KEYS.has(key.toLowerCase())) return null;
  }

  const basePath = url.pathname.replace(/\/+$/, "");
  url.pathname = `${basePath}/${segments.map(encodeURIComponent).join("/")}`;
  url.search = "";
  url.hash = "";
  return url.toString();
};
