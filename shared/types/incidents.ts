export type IncidentSeverity = "error" | "warn" | "info";

export type IncidentSource =
  | "renderer"
  | "desktop-main"
  | "supabase-client"
  | "react-query";

export type IncidentCategory = "auth" | "network" | "ui" | "runtime" | "storage";

export interface IncidentContext {
  route?: string | null;
  action?: string | null;
  feature?: string | null;
  operation?: string | null;
  http_status?: number | null;
  retry_count?: number | null;
  provider?: string | null;
  reason?: string | null;
  release_channel?: string | null;
  platform?: string | null;
  os?: string | null;
  user_id?: string | null;
  organization_id?: string | null;
}

export interface IncidentEventInput {
  severity: IncidentSeverity;
  source: IncidentSource;
  category: IncidentCategory;
  code: string;
  message: string;
  stack?: string | null;
  context?: IncidentContext;
  occurredAt?: string;
  notifyUser?: boolean;
}

export interface IncidentLogResult {
  incidentId: string;
}

export interface FatalIncidentNotice {
  incidentId: string;
  message: string;
}
