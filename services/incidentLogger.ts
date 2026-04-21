import { APP_VERSION } from "@/config/version";
import { sanitizeLogText } from "@/shared/security/logSanitizer";
import type {
  FatalIncidentNotice,
  IncidentContext,
  IncidentEventInput,
  IncidentLogResult,
} from "@/shared/types/incidents";
import { isDesktop, platformAdapter } from "./platformAdapter";
import { supabase } from "./supabase";

const INCIDENT_QUEUE_STORAGE_KEY = "app_incident_queue_v1";
const INCIDENT_SESSION_STORAGE_KEY = "app_incident_session_id_v1";
const MAX_QUEUED_INCIDENTS = 200;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_STACK_LENGTH = 4000;
const MAX_CODE_LENGTH = 128;
const MAX_CONTEXT_VALUE_LENGTH = 256;
const FATAL_NOTICE_COOLDOWN_MS = 10_000;
const GLOBAL_FATAL_EVENT_NAME = "app-incident:fatal";

type PersistedIncidentPayload = {
  incident_id: string;
  occurred_at: string;
  severity: "error" | "warn" | "info";
  source: "renderer" | "desktop-main" | "supabase-client" | "react-query";
  category: "auth" | "network" | "ui" | "runtime" | "storage";
  code: string;
  message: string;
  stack: string | null;
  fingerprint: string;
  app_version: string;
  release_channel: string;
  platform: "desktop" | "web";
  os: string;
  route: string;
  session_id: string;
  context: Record<string, string | number | null>;
};

const ALLOWED_CONTEXT_KEYS = new Set<keyof IncidentContext>([
  "route",
  "action",
  "feature",
  "operation",
  "function_name",
  "http_status",
  "retry_count",
  "provider",
  "reason",
  "release_channel",
  "platform",
  "os",
  "user_id",
  "organization_id",
  "project_id",
  "category_id",
  "entity_id",
  "entity_type",
  "folder_path",
  "target_path",
  "action_status",
]);

let initializedGlobalHandlers = false;
let flushInFlight: Promise<void> | null = null;
let lastFatalNoticeAt = 0;
const mutableContext: IncidentContext = {};

const toShortId = (): string => {
  const seed =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  return `INC-${seed.slice(0, 12).toUpperCase()}`;
};

const getCurrentRoute = (): string => {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname || "/"}${window.location.search || ""}`;
};

const getReleaseChannel = (): string =>
  import.meta.env.DEV ? "development" : "production";

const getPlatformLabel = (): "desktop" | "web" => (isDesktop ? "desktop" : "web");

const getOsLabel = (): string =>
  platformAdapter.platform?.os ? String(platformAdapter.platform.os) : "web";

const sanitizeText = (value: unknown, maxLen: number): string =>
  sanitizeLogText(value, maxLen);

const sanitizeCode = (value: unknown): string =>
  sanitizeText(value ?? "UNKNOWN", MAX_CODE_LENGTH).replace(/\s+/g, "_").toUpperCase();

const normalizeContextValue = (value: unknown): string | number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return sanitizeText(value, MAX_CONTEXT_VALUE_LENGTH);
};

const sanitizeContext = (context: IncidentContext = {}): Record<string, string | number | null> => {
  const merged = {
    ...mutableContext,
    ...context,
  };

  const out: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (!ALLOWED_CONTEXT_KEYS.has(key as keyof IncidentContext)) continue;
    out[key] = normalizeContextValue(value);
  }
  return out;
};

const hashFingerprint = (value: string): string => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return `fp_${(hash >>> 0).toString(16)}`;
};

const getSessionId = (): string => {
  if (typeof window === "undefined") return `SID-${Date.now().toString(16)}`;

  const existing = window.sessionStorage.getItem(INCIDENT_SESSION_STORAGE_KEY);
  if (existing) return existing;

  const sessionId = `SID-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`.toUpperCase();
  window.sessionStorage.setItem(INCIDENT_SESSION_STORAGE_KEY, sessionId);
  return sessionId;
};

const buildPayload = (input: IncidentEventInput): PersistedIncidentPayload => {
  const incidentId = toShortId();
  const sanitizedMessage = sanitizeText(input.message, MAX_MESSAGE_LENGTH);
  const sanitizedStack = input.stack ? sanitizeText(input.stack, MAX_STACK_LENGTH) : null;
  const mergedContext = sanitizeContext(input.context);
  const route = sanitizeText(
    (mergedContext.route as string | null | undefined) ?? getCurrentRoute(),
    MAX_CONTEXT_VALUE_LENGTH,
  );
  const fingerprintSeed = [
    input.source,
    input.category,
    sanitizeCode(input.code),
    sanitizedMessage,
    sanitizedStack?.split("\n").slice(0, 3).join("|") ?? "",
  ].join("|");

  return {
    incident_id: incidentId,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    severity: input.severity,
    source: input.source,
    category: input.category,
    code: sanitizeCode(input.code),
    message: sanitizedMessage,
    stack: sanitizedStack,
    fingerprint: hashFingerprint(fingerprintSeed),
    app_version: APP_VERSION,
    release_channel: getReleaseChannel(),
    platform: getPlatformLabel(),
    os: sanitizeText(getOsLabel(), 32),
    route,
    session_id: getSessionId(),
    context: mergedContext,
  };
};

const readQueue = async (): Promise<PersistedIncidentPayload[]> => {
  try {
    const raw = await platformAdapter.storage.get(INCIDENT_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PersistedIncidentPayload[]) : [];
  } catch {
    return [];
  }
};

const writeQueue = async (queue: PersistedIncidentPayload[]): Promise<void> => {
  try {
    if (!queue.length) {
      await platformAdapter.storage.delete(INCIDENT_QUEUE_STORAGE_KEY);
      return;
    }
    await platformAdapter.storage.set(INCIDENT_QUEUE_STORAGE_KEY, JSON.stringify(queue.slice(-MAX_QUEUED_INCIDENTS)));
  } catch {
    // ignore queue persistence failures
  }
};

const enqueueIncident = async (payload: PersistedIncidentPayload): Promise<void> => {
  const queue = await readQueue();
  queue.push(payload);
  await writeQueue(queue);
};

const canSendIncidentNow = async (): Promise<boolean> => {
  const authApi = (supabase as any)?.auth;
  if (!authApi || typeof authApi.getSession !== "function") {
    return true;
  }

  try {
    const { data } = await authApi.getSession();
    const session = data?.session;
    if (!session?.user?.id) return false;

    // Reject expired tokens — sending with an expired token causes a 400 from the server
    if (session.expires_at) {
      const expiresAt = typeof session.expires_at === 'number'
        ? session.expires_at * 1000
        : new Date(session.expires_at).getTime();
      if (expiresAt < Date.now()) return false;
    }

    return true;
  } catch {
    return false;
  }
};

const sendPayload = async (payload: PersistedIncidentPayload): Promise<void> => {
  const canSendNow = await canSendIncidentNow();
  if (!canSendNow) {
    throw new Error("AUTH_REQUIRED_FOR_INCIDENT_LOGGING");
  }

  const { error } = await supabase.rpc("log_app_incident", {
    input: payload,
  });
  if (error) throw error;
};

const notifyFatalIncident = (notice: FatalIncidentNotice): void => {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastFatalNoticeAt < FATAL_NOTICE_COOLDOWN_MS) return;
  lastFatalNoticeAt = now;

  window.dispatchEvent(new CustomEvent<FatalIncidentNotice>(GLOBAL_FATAL_EVENT_NAME, { detail: notice }));
};

export const flushIncidentQueue = async (): Promise<void> => {
  if (flushInFlight) return flushInFlight;

  flushInFlight = (async () => {
    const queue = await readQueue();
    if (!queue.length) return;

    const remaining: PersistedIncidentPayload[] = [];
    for (const payload of queue) {
      try {
        await sendPayload(payload);
      } catch {
        remaining.push(payload);
      }
    }

    await writeQueue(remaining);
  })();

  try {
    await flushInFlight;
  } finally {
    flushInFlight = null;
  }
};

export const setIncidentContext = (partial: IncidentContext): void => {
  Object.assign(mutableContext, partial);
};

export const logIncident = async (input: IncidentEventInput): Promise<IncidentLogResult> => {
  const payload = buildPayload(input);

  try {
    await sendPayload(payload);
  } catch {
    await enqueueIncident(payload);
  }

  if (input.notifyUser && input.severity === "error") {
    notifyFatalIncident({
      incidentId: payload.incident_id,
      message: payload.message,
    });
  }

  void flushIncidentQueue();

  return { incidentId: payload.incident_id };
};

const normalizeUnknownError = (value: unknown): { message: string; stack: string | null } => {
  if (value instanceof Error) {
    return {
      message: value.message || "Unknown error",
      stack: value.stack ? String(value.stack) : null,
    };
  }
  return {
    message: sanitizeText(value, MAX_MESSAGE_LENGTH),
    stack: null,
  };
};

const isTransientAuthMessage = (message: string): boolean => {
  const m = message.toLowerCase();
  return (
    m.includes("refresh token") ||
    m.includes("invalid refresh") ||
    m.includes("refresh_token_not_found") ||
    m.includes("jwt expired") ||
    m.includes("jwt") && m.includes("expired") ||
    m.includes("auth session missing") ||
    m.includes("not authenticated") ||
    (m.includes("401") && m.includes("unauth"))
  );
};

export const initIncidentGlobalHandlers = (): void => {
  if (initializedGlobalHandlers || typeof window === "undefined") return;
  initializedGlobalHandlers = true;

  window.addEventListener("error", (event) => {
    const message = event.message || "Unhandled window error";
    const transient = isTransientAuthMessage(message);
    void logIncident({
      severity: transient ? "warn" : "error",
      source: "renderer",
      category: transient ? "auth" : "runtime",
      code: transient ? "AUTH_TRANSIENT_WINDOW_ERROR" : "WINDOW_ERROR",
      message,
      stack: event.error?.stack ? String(event.error.stack) : null,
      context: {
        route: getCurrentRoute(),
        operation: "window.error",
      },
      notifyUser: !transient,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const normalized = normalizeUnknownError(event.reason);
    const message = normalized.message || "Unhandled promise rejection";
    const transient = isTransientAuthMessage(message);
    void logIncident({
      severity: transient ? "warn" : "error",
      source: "renderer",
      category: transient ? "auth" : "runtime",
      code: transient ? "AUTH_TRANSIENT_REJECTION" : "UNHANDLED_REJECTION",
      message,
      stack: normalized.stack,
      context: {
        route: getCurrentRoute(),
        operation: "window.unhandledrejection",
      },
      notifyUser: !transient,
    });
  });

  window.addEventListener("online", () => {
    void flushIncidentQueue();
  });

  void flushIncidentQueue();
};

export const INCIDENT_FATAL_EVENT_NAME = GLOBAL_FATAL_EVENT_NAME;
