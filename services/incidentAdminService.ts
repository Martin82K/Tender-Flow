import { supabase } from "./supabase";

export interface IncidentAdminFilter {
  incidentId?: string;
  userId?: string;
  userEmail?: string;
  actionOrCode?: string;
  fromTs?: string;
  toTs?: string;
  limit?: number;
}

export interface IncidentAdminItem {
  id: string;
  incident_id: string;
  occurred_at: string;
  ingested_at: string;
  severity: string;
  source: string;
  category: string;
  code: string;
  message: string;
  stack: string | null;
  fingerprint: string;
  app_version: string;
  release_channel: string;
  platform: string;
  os: string;
  route: string;
  session_id: string;
  user_id: string | null;
  user_email: string | null;
  organization_id: string | null;
  context: Record<string, unknown>;
}

const isLegacyIncidentAdminRpcError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? Number((error as { status?: number }).status) : null;
  const code = "code" in error ? String((error as { code?: string }).code ?? "") : "";
  const message =
    "message" in error ? String((error as { message?: string }).message ?? "").toLowerCase() : "";

  return (
    status === 404 ||
    code === "PGRST202" ||
    message.includes("could not find the function public.get_app_incidents_admin") ||
    message.includes("no route matched")
  );
};

export async function getAppIncidentsAdmin(
  filter: IncidentAdminFilter = {},
): Promise<IncidentAdminItem[]> {
  const nextParams = {
    incident_id_filter: filter.incidentId ?? null,
    user_id_filter: filter.userId ?? null,
    email_filter: filter.userEmail ?? null,
    action_or_code_filter: filter.actionOrCode ?? null,
    from_ts: filter.fromTs ?? null,
    to_ts: filter.toTs ?? null,
    max_rows: filter.limit ?? 200,
  };

  const { data, error } = await supabase.rpc("get_app_incidents_admin", nextParams);

  if (!error) {
    return (data ?? []) as IncidentAdminItem[];
  }

  if (!isLegacyIncidentAdminRpcError(error)) {
    throw error;
  }

  const { data: legacyData, error: legacyError } = await supabase.rpc("get_app_incidents_admin", {
    incident_id_filter: filter.incidentId ?? null,
    user_id_filter: filter.userId ?? null,
    from_ts: filter.fromTs ?? null,
    to_ts: filter.toTs ?? null,
    max_rows: filter.limit ?? 200,
  });

  if (legacyError) {
    throw legacyError;
  }

  return ((legacyData ?? []) as Omit<IncidentAdminItem, "user_email">[]).map((item) => ({
    ...item,
    user_email: null,
  }));
}

export async function purgeOldAppIncidentsAdmin(daysToKeep: number): Promise<number> {
  const sanitizedDays = Math.min(365, Math.max(7, Math.floor(daysToKeep || 60)));
  const { data, error } = await supabase.rpc("purge_old_app_incident_events_admin", {
    days_to_keep: sanitizedDays,
  });

  if (error) {
    throw error;
  }

  return Number(data ?? 0);
}
