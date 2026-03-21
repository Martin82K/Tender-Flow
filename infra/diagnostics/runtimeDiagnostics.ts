import { isDesktop, platformAdapter } from "@/services/platformAdapter";
import {
  SECRET_KEY_PATTERN,
  sanitizeLogText,
} from "@/shared/security/logSanitizer";

type DiagnosticLevel = "debug" | "info" | "warn" | "error";

export interface RuntimeDiagnosticEvent {
  seq: number;
  ts: string;
  level: DiagnosticLevel;
  scope: string;
  event: string;
  route: string;
  runId: string;
  sessionId: string;
  data?: unknown;
}

interface RuntimeDiagnosticSnapshot {
  app: {
    platform: "desktop" | "web";
    os: string;
    userAgent: string;
    protocol: string;
  };
  run: {
    runId: string;
    sessionId: string;
    generatedAt: string;
    count: number;
  };
  events: RuntimeDiagnosticEvent[];
}

const STORAGE_KEY = "app_runtime_diagnostics_v1";
const SESSION_ID_KEY = "app_runtime_diag_session_id_v1";
const RUN_ID_KEY = "app_runtime_diag_run_id_v1";
const MAX_EVENTS = 1500;
const MAX_STRING_LEN = 500;
const CONSOLE_PREFIX_ALLOWLIST = [
  "[AuthContext]",
  "AuthContext:",
  "[authService]",
  "[authSessionService]",
  "[Supabase]",
  "[App]",
  "[Headers]",
  "[QueryClient]",
  "[Router]",
  "[AuthGate]",
];
let events: RuntimeDiagnosticEvent[] = [];
let seq = 0;
let initialized = false;
let persistTimer: number | null = null;
let loadPromise: Promise<void> | null = null;
let persistPromise: Promise<void> | null = null;
let consolePatched = false;

const createId = (prefix: string): string => {
  const seed =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;
  return `${prefix}-${seed.toUpperCase()}`;
};

const getSessionId = (): string => {
  if (typeof window === "undefined") return createId("SID");
  const existing = window.sessionStorage.getItem(SESSION_ID_KEY);
  if (existing) return existing;
  const value = createId("SID");
  window.sessionStorage.setItem(SESSION_ID_KEY, value);
  return value;
};

const getRunId = (): string => {
  if (typeof window === "undefined") return createId("RUN");
  const existing = window.sessionStorage.getItem(RUN_ID_KEY);
  if (existing) return existing;
  const value = createId("RUN");
  window.sessionStorage.setItem(RUN_ID_KEY, value);
  return value;
};

const getRoute = (): string => {
  if (typeof window === "undefined") return "/";
  const pathname = window.location.pathname || "/";
  const search = window.location.search ? "?[redacted]" : "";
  const hash = window.location.hash ? "#[redacted]" : "";
  return `${pathname}${search}${hash}`;
};

const safeString = (value: unknown): string => {
  const raw = String(value ?? "");
  if (!raw) return "";
  if (raw.length <= MAX_STRING_LEN) return raw;
  return `${raw.slice(0, MAX_STRING_LEN)}…`;
};

const sanitizeValue = (value: unknown, keyHint = ""): unknown => {
  if (value === null || value === undefined) return value;
  if (SECRET_KEY_PATTERN.test(keyHint)) return "[redacted]";
  if (typeof value === "string") {
    return safeString(sanitizeLogText(value, MAX_STRING_LEN));
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: safeString(value.message),
      stack: value.stack ? safeString(value.stack) : null,
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sanitizeValue(val, key);
    }
    return out;
  }
  return safeString(value);
};

const schedulePersist = (): void => {
  if (persistTimer !== null || typeof window === "undefined") return;
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    persistPromise = (async () => {
      try {
        await platformAdapter.storage.set(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
      } catch {
        // best-effort only
      }
    })();
  }, 400);
};

const ensureLoaded = async (): Promise<void> => {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await platformAdapter.storage.get(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      events = parsed.slice(-MAX_EVENTS).filter(Boolean);
      seq = events.reduce((max, item) => Math.max(max, Number(item?.seq || 0)), 0);
    } catch {
      events = [];
      seq = 0;
    }
  })();
  await loadPromise;
};

export const logRuntimeEvent = (
  scope: string,
  event: string,
  data?: unknown,
  level: DiagnosticLevel = "info",
): void => {
  const payload: RuntimeDiagnosticEvent = {
    seq: ++seq,
    ts: new Date().toISOString(),
    level,
    scope: safeString(scope || "runtime"),
    event: safeString(event || "event"),
    route: getRoute(),
    runId: getRunId(),
    sessionId: getSessionId(),
    data: sanitizeValue(data),
  };

  events.push(payload);
  if (events.length > MAX_EVENTS) {
    events = events.slice(-MAX_EVENTS);
  }
  schedulePersist();
};

export const getRuntimeDiagnosticsSnapshot = (): RuntimeDiagnosticSnapshot => {
  const platform = isDesktop ? "desktop" : "web";
  const os = platformAdapter.platform?.os ? String(platformAdapter.platform.os) : "unknown";
  const userAgent = typeof navigator === "undefined" ? "unknown" : navigator.userAgent;
  const protocol = typeof window === "undefined" ? "unknown" : window.location.protocol;

  return {
    app: {
      platform,
      os,
      userAgent: safeString(userAgent),
      protocol,
    },
    run: {
      runId: getRunId(),
      sessionId: getSessionId(),
      generatedAt: new Date().toISOString(),
      count: events.length,
    },
    events: [...events],
  };
};

export const clearRuntimeDiagnostics = async (): Promise<void> => {
  events = [];
  seq = 0;
  try {
    await platformAdapter.storage.delete(STORAGE_KEY);
  } catch {
    // best-effort only
  }
};

export const exportRuntimeDiagnostics = async (): Promise<{
  success: boolean;
  filename: string;
  eventCount: number;
}> => {
  await ensureLoaded();
  if (persistPromise) {
    try {
      await persistPromise;
    } catch {
      // ignore
    }
  }

  const snapshot = getRuntimeDiagnosticsSnapshot();
  const filename = `tender-flow-debug-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const content = JSON.stringify(snapshot, null, 2);

  if (isDesktop) {
    await platformAdapter.shell.openTempFile(content, filename);
  } else if (typeof window !== "undefined") {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  logRuntimeEvent("diagnostics", "exported", {
    filename,
    eventCount: snapshot.events.length,
  });

  return {
    success: true,
    filename,
    eventCount: snapshot.events.length,
  };
};

const shouldCaptureConsole = (method: "log" | "info" | "warn" | "error", args: unknown[]): boolean => {
  if (method === "warn" || method === "error") return true;
  const first = safeString(args[0] ?? "");
  return CONSOLE_PREFIX_ALLOWLIST.some((prefix) => first.includes(prefix));
};

const patchConsole = (): void => {
  if (consolePatched || typeof window === "undefined") return;
  consolePatched = true;

  (["log", "info", "warn", "error"] as const).forEach((method) => {
    const original = console[method].bind(console);
    console[method] = ((...args: unknown[]) => {
      try {
        if (shouldCaptureConsole(method, args)) {
          logRuntimeEvent(
            "console",
            method,
            {
              args: sanitizeValue(args),
            },
            method === "error" ? "error" : method === "warn" ? "warn" : "info",
          );
        }
      } catch {
        // never break console
      }
      original(...args);
    }) as any;
  });
};

const attachGlobalDebugApi = (): void => {
  if (typeof window === "undefined") return;
  window.__TF_DEBUG__ = {
    dump: () => getRuntimeDiagnosticsSnapshot(),
    export: () => exportRuntimeDiagnostics(),
    clear: () => clearRuntimeDiagnostics(),
    getEvents: () => [...events],
  };
};

export const initRuntimeDiagnostics = (): void => {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  void ensureLoaded().then(() => {
    logRuntimeEvent("runtime", "init", {
      href: window.location.href,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      isDesktop,
      os: platformAdapter.platform?.os || "unknown",
    });
  });

  patchConsole();
  attachGlobalDebugApi();

  window.addEventListener("error", (event) => {
    logRuntimeEvent(
      "runtime",
      "window_error",
      {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      },
      "error",
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    logRuntimeEvent(
      "runtime",
      "unhandled_rejection",
      {
        reason: event.reason,
      },
      "error",
    );
  });

  window.addEventListener("online", () => {
    logRuntimeEvent("runtime", "network_online");
  });

  window.addEventListener("offline", () => {
    logRuntimeEvent("runtime", "network_offline", undefined, "warn");
  });
};

declare global {
  interface Window {
    __TF_DEBUG__?: {
      dump: () => RuntimeDiagnosticSnapshot;
      export: () => Promise<{ success: boolean; filename: string; eventCount: number }>;
      clear: () => Promise<void>;
      getEvents: () => RuntimeDiagnosticEvent[];
    };
  }
}
