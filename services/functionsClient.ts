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

  const url = `${supabaseUrl}/functions/v1/${name}`;
  const method = options.method || "POST";

  const res = await fetch(url, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: method === "GET" ? undefined : JSON.stringify(options.body ?? {}),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    const message = json?.error || json?.message || text || `HTTP ${res.status}`;
    throw new Error(message);
  }

  return (json ?? {}) as TResponse;
};

