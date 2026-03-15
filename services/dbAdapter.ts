import { supabase } from "./supabase";

export const dbAdapter = {
  from: <T extends string>(table: T) => supabase.from(table),
  rpc: <T = unknown>(fn: string, args?: Record<string, unknown>) =>
    supabase.rpc<T>(fn, args),
  rpcRest: async <T = unknown>(fn: string, args?: Record<string, unknown>) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

    if (!supabaseUrl || !supabaseAnonKey || typeof fetch !== "function") {
      return supabase.rpc<T>(fn, args);
    }

    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token ?? supabaseAnonKey;
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args ?? {}),
    });

    if (!response.ok) {
      let errorPayload: unknown = null;
      try {
        errorPayload = await response.json();
      } catch {
        errorPayload = await response.text();
      }

      return {
        data: null,
        error:
          errorPayload && typeof errorPayload === "object"
            ? errorPayload
            : { code: `HTTP_${response.status}`, message: String(errorPayload || response.statusText) },
      };
    }

    return {
      data: (await response.json()) as T,
      error: null,
    };
  },
};
