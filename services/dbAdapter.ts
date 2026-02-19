import { supabase } from "./supabase";

export const dbAdapter = {
  from: <T extends string>(table: T) => supabase.from(table),
  rpc: <T = unknown>(fn: string, args?: Record<string, unknown>) =>
    supabase.rpc<T>(fn, args),
};
