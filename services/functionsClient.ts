import { supabase } from "./supabase";
import { logIncident } from "./incidentLogger";
import { sanitizeLogText, summarizeErrorForLog } from "../shared/security/logSanitizer";

type InvokeOptions = {
  body?: unknown;
  method?: "POST" | "GET";
  timeoutMs?: number;
  retries?: number;
  idempotencyKey?: string;
};

const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_RETRIES = 0;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const buildHeaders = (
  anonKey: string,
  bearer: string,
  idempotencyKey?: string,
): Record<string, string> => ({
  apikey: anonKey,
  Authorization: `Bearer ${bearer}`,
  "content-type": "application/json",
  ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
});

const getRequiredEnv = (key: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY") => {
  const value =
    key === "VITE_SUPABASE_URL"
      ? import.meta.env.VITE_SUPABASE_URL
      : import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
};

const logFunctionInvokeFailure = async (
  name: string,
  method: "POST" | "GET",
  timeoutMs: number,
  retries: number,
  error: unknown,
): Promise<void> => {
  const message = error instanceof Error ? error.message : String(error);
  const httpStatus =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: number }).status) || null
      : null;

  try {
    await logIncident({
      severity: "error",
      source: "renderer",
      category: "network",
      code: "FUNCTION_INVOKE_FAILED",
      message: `Volání edge funkce ${name} selhalo: ${message}`,
      stack: error instanceof Error ? error.stack : null,
      context: {
        action: "invoke_function",
        operation: "functions_client.invoke_authed_function",
        function_name: name,
        http_status: httpStatus,
        retry_count: retries,
        reason: `${message} (timeout ${timeoutMs} ms)`,
        action_status: "error",
        entity_type: "supabase_function",
        entity_id: name,
        target_path: method,
      },
    });
  } catch {
    // logging failure must never block function caller
  }
};

export const invokeAuthedFunction = async <TResponse>(
  name: string,
  options: InvokeOptions = {}
): Promise<TResponse> => {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error("Nejste přihlášen v aplikaci (chybí session).");
  }

  const supabaseUrl = getRequiredEnv("VITE_SUPABASE_URL");
  const anonKey = getRequiredEnv("VITE_SUPABASE_ANON_KEY");

  const url = `${supabaseUrl}/functions/v1/${name}`;
  const method = options.method || "POST";
  const retries = Math.max(0, Number.isFinite(options.retries) ? Number(options.retries) : DEFAULT_RETRIES);
  const timeoutMs = Math.max(1_000, Number.isFinite(options.timeoutMs) ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS);
  const idempotencyKey = options.idempotencyKey;

  // @ts-ignore - electronAPI is injected via preload
  const isDesktop = typeof window !== 'undefined' && window.electronAPI?.platform?.isDesktop;

  if (isDesktop) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        // @ts-ignore
        const res = await window.electronAPI.net.request(url, {
          method,
          headers: buildHeaders(anonKey, accessToken, idempotencyKey),
          body: method === "GET" ? undefined : JSON.stringify(options.body ?? {}),
          timeoutMs,
        } as any);

        if (!res.ok) {
          // Enhanced error handling for IPC response
          let errorMsg = res.statusText || `HTTP ${res.status}`;
          try {
            const errorJson = JSON.parse(res.text);
            errorMsg = errorJson.error || errorJson.message || errorMsg;
            if (errorJson.details) {
              const detailStr = typeof errorJson.details === 'object' ? JSON.stringify(errorJson.details) : String(errorJson.details);
              errorMsg += ` (${detailStr})`;
            }
          } catch {
            // ignore JSON parse error, use text if available
            if (res.text && res.text.length < 500) errorMsg = res.text;
          }
          throw new Error(errorMsg);
        }

        try {
          return (res.text ? JSON.parse(res.text) : {}) as TResponse;
        } catch {
          console.warn('Failed to parse (IPC)', sanitizeLogText(res.text, 200));
          return {} as TResponse;
        }
      } catch (error) {
        lastError = error;
        if (attempt >= retries) break;
        await wait(250 * (attempt + 1));
      }
    }
    await logFunctionInvokeFailure(name, method, timeoutMs, retries, lastError);
    throw lastError instanceof Error ? lastError : new Error("Function IPC call failed");

  } else {
    // Normal Web Fetch
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        let res: Response;
        try {
          res = await fetch(url, {
            method,
            headers: buildHeaders(anonKey, accessToken, idempotencyKey),
            body: method === "GET" ? undefined : JSON.stringify(options.body ?? {}),
            mode: 'cors',
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        const text = await res.text();
        let json: any = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          // ignore
        }

        if (!res.ok) {
          const errorData = json?.error || json?.message || json;
          let message = typeof errorData === 'object' ? JSON.stringify(errorData) : (errorData || text || `HTTP ${res.status}`);
          if (json?.details) {
            const detailStr = typeof json.details === 'object' ? JSON.stringify(json.details) : String(json.details);
            message += ` Details: ${detailStr}`;
          }
          throw new Error(message);
        }

        return (json ?? {}) as TResponse;
      } catch (err: unknown) {
        lastError = err;
        if (attempt >= retries) break;
        await wait(250 * (attempt + 1));
      }
    }
    await logFunctionInvokeFailure(name, method, timeoutMs, retries, lastError);
    const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
    console.error(`[Function Error] Failed to fetch ${name}`, summarizeErrorForLog(lastError));
    throw new Error(`Failed to fetch ${url} (Supabase URL: ${supabaseUrl}). Original error: ${errorMsg}`);
  }
};

export const invokePublicFunction = async <TResponse>(
  name: string,
  options: InvokeOptions = {}
): Promise<TResponse> => {
  const supabaseUrl = getRequiredEnv("VITE_SUPABASE_URL");
  const anonKey = getRequiredEnv("VITE_SUPABASE_ANON_KEY");

  const url = `${supabaseUrl}/functions/v1/${name}`;
  const method = options.method || "POST";

  // @ts-ignore - electronAPI is injected via preload
  const isDesktop = typeof window !== 'undefined' && window.electronAPI?.platform?.isDesktop;

  if (isDesktop) {
    // @ts-ignore
    const res = await window.electronAPI.net.request(url, {
      method,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`, // Use Anon Key as Bearer for public functions if needed, or just omit if function handles it. Supabase functions usually need Authorization: Bearer <anon_key> for public access if VerifyJWT is not strictly identifying user but just valid client.
        "content-type": "application/json",
      },
      body: method === "GET" ? undefined : JSON.stringify(options.body ?? {}),
    });

    if (!res.ok) {
      let errorMsg = res.statusText || `HTTP ${res.status}`;
      try {
        const errorJson = JSON.parse(res.text);
        errorMsg = errorJson.error || errorJson.message || errorMsg;
        if (errorJson.details) {
            const detailStr = typeof errorJson.details === 'object' ? JSON.stringify(errorJson.details) : String(errorJson.details);
            errorMsg += ` (${detailStr})`;
        }
      } catch {
        if (res.text && res.text.length < 500) errorMsg = res.text;
      }
      throw new Error(errorMsg);
    }

    try {
      return (res.text ? JSON.parse(res.text) : {}) as TResponse;
    } catch (e) {
      return {} as TResponse;
    }

  } else {
    // Normal Web Fetch
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`, // Public functions still need anon key as Bearer usually
          "content-type": "application/json",
        },
        body: method === "GET" ? undefined : JSON.stringify(options.body ?? {}),
        mode: 'cors',
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to fetch ${url}. Original error: ${errorMsg}`);
    }

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch { }

    if (!res.ok) {
      const errorData = json?.error || json?.message || json;
      let message = typeof errorData === 'object' ? JSON.stringify(errorData) : (errorData || text || `HTTP ${res.status}`);
      
      if (json?.details) {
        const detailStr = typeof json.details === 'object' ? JSON.stringify(json.details) : String(json.details);
        message += ` Details: ${detailStr}`;
      }
      throw new Error(message);
    }

    return (json ?? {}) as TResponse;
  }
};
