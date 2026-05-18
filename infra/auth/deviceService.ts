import { supabase } from "@/services/supabase";
import { isDesktop, platformAdapter } from "@/services/platformAdapter";

const INSTALLATION_ID_STORAGE_KEY = "tender_flow_installation_id_v1";

export type AuthDeviceClientKind = "desktop" | "mobile" | "web";
export type AuthDeviceStatus = "active" | "revoked";

export interface AuthDevice {
  id: string;
  installationId: string;
  deviceName: string;
  clientKind: AuthDeviceClientKind;
  platform: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  authSessionId: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
  status: AuthDeviceStatus;
  isCurrent: boolean;
}

interface RawAuthDevice {
  id?: string | null;
  installation_id?: string | null;
  device_name?: string | null;
  client_kind?: string | null;
  platform?: string | null;
  user_agent?: string | null;
  ip_address?: string | null;
  auth_session_id?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  revoked_at?: string | null;
  status?: string | null;
}

const isMobileUserAgent = (userAgent: string): boolean =>
  /(iphone|ipad|ipod|android|mobile|windows phone|iemobile|opera mini|blackberry)/i.test(userAgent);

const createInstallationId = (): string => {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return randomUuid;
  return `tf-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
};

export const getCurrentInstallationId = (): string => {
  if (typeof window === "undefined") return createInstallationId();

  try {
    const existing = window.localStorage.getItem(INSTALLATION_ID_STORAGE_KEY);
    if (existing && existing.length <= 128) return existing;

    const created = createInstallationId();
    window.localStorage.setItem(INSTALLATION_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return createInstallationId();
  }
};

const getUserAgent = (): string | null => {
  if (typeof navigator === "undefined") return null;
  return navigator.userAgent || null;
};

const getClientKind = (): AuthDeviceClientKind => {
  if (isDesktop) return "desktop";
  const userAgent = getUserAgent();
  if (userAgent && isMobileUserAgent(userAgent)) return "mobile";
  return "web";
};

const getPlatformLabel = (): string | null => {
  if (isDesktop) return platformAdapter.platform?.os || "desktop";
  if (typeof navigator === "undefined") return null;
  return navigator.platform || null;
};

const getDeviceName = (clientKind: AuthDeviceClientKind, platformLabel: string | null): string => {
  const userAgent = getUserAgent() || "";
  if (isDesktop) {
    const os = platformAdapter.platform?.os;
    if (os === "darwin") return "Mac";
    if (os === "win32") return "Windows PC";
    if (os === "linux") return "Linux PC";
    return "Desktop";
  }

  if (/iphone/i.test(userAgent)) return "iPhone";
  if (/ipad/i.test(userAgent)) return "iPad";
  if (/android/i.test(userAgent)) return "Android";
  if (/windows/i.test(userAgent)) return "Windows Web";
  if (/macintosh|mac os/i.test(userAgent)) return "Mac Web";
  if (/linux/i.test(userAgent)) return "Linux Web";

  if (clientKind === "mobile") return "Mobilní zařízení";
  return platformLabel ? `Web (${platformLabel})` : "Webový prohlížeč";
};

const normalizeClientKind = (value: string | null | undefined): AuthDeviceClientKind => {
  if (value === "desktop" || value === "mobile" || value === "web") return value;
  return "web";
};

const normalizeStatus = (value: string | null | undefined): AuthDeviceStatus =>
  value === "active" ? "active" : "revoked";

const toAuthDevice = (row: RawAuthDevice, currentInstallationId: string): AuthDevice => {
  const installationId = row.installation_id || "";
  return {
    id: row.id || "",
    installationId,
    deviceName: row.device_name || "Neznámé zařízení",
    clientKind: normalizeClientKind(row.client_kind),
    platform: row.platform || null,
    userAgent: row.user_agent || null,
    ipAddress: row.ip_address || null,
    authSessionId: row.auth_session_id || null,
    firstSeenAt: row.first_seen_at || null,
    lastSeenAt: row.last_seen_at || null,
    revokedAt: row.revoked_at || null,
    status: normalizeStatus(row.status),
    isCurrent: installationId === currentInstallationId && normalizeStatus(row.status) === "active",
  };
};

export const authDeviceService = {
  registerCurrentDevice: async (): Promise<void> => {
    const installationId = getCurrentInstallationId();
    const clientKind = getClientKind();
    const platformLabel = getPlatformLabel();

    const { error } = await (supabase as any).rpc("upsert_current_auth_device", {
      p_installation_id: installationId,
      p_device_name: getDeviceName(clientKind, platformLabel),
      p_client_kind: clientKind,
      p_platform: platformLabel,
      p_user_agent: getUserAgent(),
    });

    if (error) throw error;
  },

  listDevices: async (): Promise<AuthDevice[]> => {
    const currentInstallationId = getCurrentInstallationId();
    const { data, error } = await (supabase as any).rpc("list_my_auth_devices");
    if (error) throw error;

    return (Array.isArray(data) ? data : [])
      .map((row) => toAuthDevice(row as RawAuthDevice, currentInstallationId))
      .filter((device) => device.id);
  },

  revokeDevice: async (deviceId: string): Promise<void> => {
    const { error } = await (supabase as any).rpc("revoke_my_auth_device", {
      p_device_id: deviceId,
    });

    if (error) throw error;
  },
};
