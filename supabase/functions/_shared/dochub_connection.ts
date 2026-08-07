import type { Provider } from "./dochub_providers.ts";

type StoredConnection = {
  rootId?: unknown;
  driveId?: unknown;
};

const getFallbackProvider = (value: unknown): Provider | null => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (hostname === "drive.google.com") return "gdrive";
    if (
      hostname === "onedrive.live.com" ||
      hostname === "1drv.ms" ||
      hostname.endsWith(".sharepoint.com")
    ) {
      return "onedrive";
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
  const fallbackProvider = getFallbackProvider(project.dochub_root_web_url);
  const candidates: Array<{ key: string; provider: Provider }> = [
    { key: "gdrive", provider: "gdrive" },
    { key: "onedrive_cloud", provider: "onedrive" },
  ].filter((candidate) => !fallbackProvider || candidate.provider === fallbackProvider);
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
