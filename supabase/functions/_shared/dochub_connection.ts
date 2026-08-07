import type { Provider } from "./dochub_providers.ts";

type StoredConnection = {
  rootId?: unknown;
  driveId?: unknown;
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
  const candidates: Array<{ key: string; provider: Provider }> = [
    { key: "gdrive", provider: "gdrive" },
    { key: "onedrive_cloud", provider: "onedrive" },
  ];
  for (const candidate of candidates) {
    const stored = settings[candidate.key];
    const rootId = typeof stored?.rootId === "string" ? stored.rootId.trim() : "";
    if (!rootId || rootId.startsWith("local:")) continue;
    const driveId = typeof stored?.driveId === "string" ? stored.driveId.trim() || null : null;
    if (candidate.provider === "onedrive" && !driveId) continue;
    return { provider: candidate.provider, rootId, driveId };
  }
  return null;
};
