import { supabase } from "./supabase";

export interface IncidentAdminFilter {
  incidentId?: string;
  userId?: string;
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
  organization_id: string | null;
  context: Record<string, unknown>;
}

export async function getAppIncidentsAdmin(
  filter: IncidentAdminFilter = {},
): Promise<IncidentAdminItem[]> {
  const { data, error } = await supabase.rpc("get_app_incidents_admin", {
    incident_id_filter: filter.incidentId ?? null,
    user_id_filter: filter.userId ?? null,
    from_ts: filter.fromTs ?? null,
    to_ts: filter.toTs ?? null,
    max_rows: filter.limit ?? 200,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as IncidentAdminItem[];
}
