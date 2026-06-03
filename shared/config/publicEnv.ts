export type PublicEnvKey =
  | "VITE_SUPABASE_URL"
  | "VITE_SUPABASE_ANON_KEY"
  | "VITE_GOOGLE_OAUTH_CLIENT_ID_DESKTOP";

type DesktopPublicEnvBridge = {
  publicEnv?: Partial<Record<PublicEnvKey, unknown>>;
};

const getDesktopPublicEnvValue = (key: PublicEnvKey): string => {
  if (typeof window === "undefined") return "";

  const electronAPI = (window as Window & { electronAPI?: DesktopPublicEnvBridge }).electronAPI;
  return normalizePublicEnvValue(electronAPI?.publicEnv?.[key]);
};

export const normalizePublicEnvValue = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  const isWrappedInDoubleQuotes = trimmed.startsWith('"') && trimmed.endsWith('"');
  const isWrappedInSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'");
  const unwrapped =
    (isWrappedInDoubleQuotes || isWrappedInSingleQuotes) && trimmed.length >= 2
      ? trimmed.slice(1, -1).trim()
      : trimmed;

  return unwrapped.replace(/[\r\n]+/g, "");
};

export const getPublicEnvValue = (key: PublicEnvKey, importMetaValue: unknown): string => {
  return normalizePublicEnvValue(importMetaValue) || getDesktopPublicEnvValue(key);
};
