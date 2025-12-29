import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const createAuthedUserClient = (req: Request) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization")! } },
  });
};

export const createServiceClient = () => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
};

