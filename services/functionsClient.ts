import { supabase } from "./supabase";

type InvokeOptions = {
  body?: unknown;
  method?: "POST" | "GET";
};

const getRequiredEnv = (key: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY") => {
  const value = import.meta.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
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

  const redactedKey = anonKey ? `${anonKey.substring(0, 5)}...` : 'MISSING';
  console.log('[Functions] Environment check:', {
    url: supabaseUrl,
    keyPrefix: redactedKey
  });

  const url = `${supabaseUrl}/functions/v1/${name}`;
  const method = options.method || "POST";

  // @ts-ignore - electronAPI is injected via preload
  const isDesktop = typeof window !== 'undefined' && window.electronAPI?.platform?.isDesktop;

  console.log('[Functions] Checking environment:', {
    isDesktop,
    hasElectronAPI: typeof window !== 'undefined' && !!window.electronAPI
  });

  if (isDesktop) {
    console.log(`[Functions] Using Desktop IPC Proxy for ${name}`);
    // @ts-ignore
    const res = await window.electronAPI.net.request(url, {
      method,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: method === "GET" ? undefined : JSON.stringify(options.body ?? {}),
    });

    if (!res.ok) {
      // Enhanced error handling for IPC response
      let errorMsg = res.statusText || `HTTP ${res.status}`;
      try {
        const errorJson = JSON.parse(res.text);
        errorMsg = errorJson.error || errorJson.message || errorMsg;
      } catch {
        // ignore JSON parse error, use text if available
        if (res.text && res.text.length < 500) errorMsg = res.text;
      }
      throw new Error(errorMsg);
    }

    try {
      return (res.text ? JSON.parse(res.text) : {}) as TResponse;
    } catch (e) {
      console.warn('Failed to parse (IPC)', res.text);
      return {} as TResponse;
    }

  } else {
    // Normal Web Fetch
    console.log(`[Invoking Function] ${name}`, { url, method });

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: method === "GET" ? undefined : JSON.stringify(options.body ?? {}),
        mode: 'cors', // Explicitly request CORS
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Function Error] Failed to fetch ${url}`, err);
      throw new Error(`Failed to fetch ${url} (Supabase URL: ${supabaseUrl}). Original error: ${errorMsg}`);
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
      const message = typeof errorData === 'object' ? JSON.stringify(errorData) : (errorData || text || `HTTP ${res.status}`);
      throw new Error(message);
    }

    return (json ?? {}) as TResponse;
  }
};

