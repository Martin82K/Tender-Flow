export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://tenderflow.cz",
  "https://www.tenderflow.cz",
];

export type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

const parseCsv = (value?: string): string[] =>
  (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseBoolean = (value?: string): boolean | null => {
  if (value == null || value.trim() === "") return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
};

export const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

export const getMaxUploadBytes = (env: Env = process.env): number =>
  parsePositiveInt(env.EXCEL_TOOLS_MAX_UPLOAD_BYTES, DEFAULT_MAX_UPLOAD_BYTES);

export const getAllowedOrigins = (env: Env = process.env): string[] => {
  const configured = parseCsv(env.EXCEL_TOOLS_ALLOWED_ORIGINS || env.CORS_ALLOW_ORIGINS);
  return configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
};

export const isOriginAllowed = (origin: string | undefined, env: Env = process.env): boolean => {
  if (!origin) return true;
  return getAllowedOrigins(env).includes(origin);
};

export const getConfiguredApiKey = (env: Env = process.env): string =>
  (env.EXCEL_TOOLS_API_KEY || env.EXCEL_API_KEY || "").trim();

export const shouldRequireAuth = (env: Env = process.env): boolean => {
  const configured = parseBoolean(env.EXCEL_TOOLS_REQUIRE_AUTH);
  if (configured != null) return configured;
  return Boolean(getConfiguredApiKey(env)) || env.NODE_ENV === "production";
};

const getBearerToken = (authorization: string | undefined): string => {
  if (!authorization?.startsWith("Bearer ")) return "";
  return authorization.slice("Bearer ".length).trim();
};

export const hasValidAuth = (
  headers: Record<string, string | string[] | undefined>,
  env: Env = process.env,
): boolean => {
  if (!shouldRequireAuth(env)) return true;

  const configuredKey = getConfiguredApiKey(env);
  if (!configuredKey) return false;

  const bearer = getBearerToken(typeof headers.authorization === "string" ? headers.authorization : undefined);
  const apiKey = Array.isArray(headers["x-api-key"]) ? headers["x-api-key"][0] : headers["x-api-key"];
  return bearer === configuredKey || apiKey === configuredKey;
};

export const sanitizeDownloadFilename = (name: string, suffix: string): string => {
  const lastSegment = name.split(/[\\/]/).pop() || "workbook.xlsx";
  const base = lastSegment.replace(/\.xlsx$/i, "");
  const normalized = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[_ .-]+|[_ .-]+$/g, "")
    .slice(0, 80);
  return `${normalized || "workbook"}${suffix}`;
};
