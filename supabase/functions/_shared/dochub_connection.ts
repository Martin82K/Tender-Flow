import type { Provider } from "./dochub_providers.ts";

type StoredConnection = {
  rootId?: unknown;
  driveId?: unknown;
  rootLink?: unknown;
  rootWebUrl?: unknown;
};

type FallbackTarget = {
  provider: Provider;
  rootWebUrl: string;
};

export type CloudDocHubConnection = {
  provider: Provider;
  rootId: string;
  driveId: string | null;
};

type CloudConnectionRecoveryDependencies = {
  getAccessTokenForUser: (args: {
    userId: string;
    provider: Provider;
  }) => Promise<{ accessToken: string }>;
  getGoogleFolderMeta: (args: {
    accessToken: string;
    folderId: string;
  }) => Promise<{ id: string; driveId?: string }>;
  parseGoogleFolderId: (value: string) => string | null;
  resolveMicrosoftSharingUrl: (args: {
    accessToken: string;
    sharingUrl: string;
  }) => Promise<{ id: string; driveId: string }>;
};

const getFallbackTarget = (value: unknown): FallbackTarget | null => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (hostname === "drive.google.com") {
      return { provider: "gdrive", rootWebUrl: url.toString() };
    }
    if (
      hostname === "onedrive.live.com" ||
      hostname === "1drv.ms" ||
      hostname.endsWith(".sharepoint.com")
    ) {
      return { provider: "onedrive", rootWebUrl: url.toString() };
    }
    return null;
  } catch {
    return null;
  }
};

export const resolveCloudDocHubConnection = (project: Record<string, unknown>): {
  provider: Provider;
  rootId: string;
  driveId: string | null;
} | null => {
  const activeProvider = project.dochub_provider;
  const activeRootId = typeof project.dochub_root_id === "string"
    ? project.dochub_root_id.trim()
    : "";
  const activeDriveId = typeof project.dochub_drive_id === "string"
    ? project.dochub_drive_id.trim() || null
    : null;
  const activeIsCloud = (activeProvider === "gdrive" || activeProvider === "onedrive") &&
    activeRootId &&
    !activeRootId.startsWith("local:");
  if (activeIsCloud) {
    return {
      provider: activeProvider as Provider,
      rootId: activeRootId,
      driveId: activeDriveId,
    };
  }

  const settings = project.dochub_settings && typeof project.dochub_settings === "object"
    ? project.dochub_settings as Record<string, StoredConnection>
    : {};
  const rawFallbackUrl = typeof project.dochub_root_web_url === "string"
    ? project.dochub_root_web_url.trim()
    : "";
  const fallbackTarget = getFallbackTarget(rawFallbackUrl);
  if (rawFallbackUrl && !fallbackTarget) return null;
  const candidates: Array<{ key: string; provider: Provider }> = [
    { key: "gdrive", provider: "gdrive" },
    { key: "onedrive_cloud", provider: "onedrive" },
  ].filter((candidate) => !fallbackTarget || candidate.provider === fallbackTarget.provider);
  for (const candidate of candidates) {
    const stored = settings[candidate.key];
    const rootId = typeof stored?.rootId === "string" ? stored.rootId.trim() : "";
    if (!rootId || rootId.startsWith("local:")) continue;
    if (fallbackTarget) {
      const storedTarget = getFallbackTarget(stored.rootWebUrl || stored.rootLink);
      if (storedTarget?.rootWebUrl !== fallbackTarget.rootWebUrl) continue;
    }
    const driveId = typeof stored?.driveId === "string" ? stored.driveId.trim() || null : null;
    if (candidate.provider === "onedrive" && !driveId) continue;
    return { provider: candidate.provider, rootId, driveId };
  }
  return null;
};

export const recoverCloudDocHubConnection = async (
  project: Record<string, unknown>,
  dependencies: CloudConnectionRecoveryDependencies,
): Promise<CloudDocHubConnection | null> => {
  const storedConnection = resolveCloudDocHubConnection(project);
  if (storedConnection) return storedConnection;

  const ownerId = typeof project.owner_id === "string" ? project.owner_id.trim() : "";
  const rawFallbackUrl = typeof project.dochub_root_web_url === "string"
    ? project.dochub_root_web_url.trim()
    : "";
  const fallbackTarget = getFallbackTarget(rawFallbackUrl);
  if (!ownerId || !fallbackTarget) return null;

  const { accessToken } = await dependencies.getAccessTokenForUser({
    userId: ownerId,
    provider: fallbackTarget.provider,
  });
  if (fallbackTarget.provider === "gdrive") {
    const folderId = dependencies.parseGoogleFolderId(fallbackTarget.rootWebUrl);
    if (!folderId) return null;
    const folder = await dependencies.getGoogleFolderMeta({ accessToken, folderId });
    return { provider: "gdrive", rootId: folder.id, driveId: null };
  }

  const folder = await dependencies.resolveMicrosoftSharingUrl({
    accessToken,
    sharingUrl: fallbackTarget.rootWebUrl,
  });
  return { provider: "onedrive", rootId: folder.id, driveId: folder.driveId };
};
