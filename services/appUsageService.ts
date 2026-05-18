import { supabase } from "./supabase";
import { summarizeErrorForLog } from "@/shared/security/logSanitizer";

export interface AppUsageActionInput {
  actionCount?: number;
  createdRecordsCount?: number;
  updatedRecordsCount?: number;
  deletedRecordsCount?: number;
  uploadedBytes?: number;
}

export interface AppUsageDailyStat {
  date: string;
  activeSeconds: number;
  sessionCount: number;
  actionCount: number;
  uploadedBytes: number;
  createdRecordsCount: number;
  updatedRecordsCount: number;
  deletedRecordsCount: number;
}

export interface AppUsageSummaryItem {
  organizationId: string;
  organizationName: string;
  userId: string;
  email: string;
  displayName: string | null;
  activeSeconds: number;
  activeDays: number;
  sessionCount: number;
  actionCount: number;
  uploadedBytes: number;
  createdRecordsCount: number;
  updatedRecordsCount: number;
  deletedRecordsCount: number;
  lastSeenAt: string | null;
  dailyStats: AppUsageDailyStat[];
}

const normalizeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clampInteger = (value: unknown, fallback: number, min: number, max: number): number => {
  if (value === undefined || value === null) return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const parsed = Math.floor(numeric);
  return Math.min(max, Math.max(min, parsed));
};

const normalizeDailyStats = (value: unknown): AppUsageDailyStat[] => {
  if (!Array.isArray(value)) return [];

  return value.map((entry) => {
    const row = entry as Record<string, unknown>;
    return {
      date: String(row.date ?? ""),
      activeSeconds: normalizeNumber(row.activeSeconds),
      sessionCount: normalizeNumber(row.sessionCount),
      actionCount: normalizeNumber(row.actionCount),
      uploadedBytes: normalizeNumber(row.uploadedBytes),
      createdRecordsCount: normalizeNumber(row.createdRecordsCount),
      updatedRecordsCount: normalizeNumber(row.updatedRecordsCount),
      deletedRecordsCount: normalizeNumber(row.deletedRecordsCount),
    };
  });
};

export async function recordUsageHeartbeat(
  sessionId: string,
  activeSeconds: number = 120,
): Promise<boolean> {
  const normalizedSeconds = clampInteger(activeSeconds, 120, 1, 300);

  try {
    const { data, error } = await supabase.rpc("record_usage_heartbeat", {
      session_id_input: sessionId,
      active_seconds_input: normalizedSeconds,
    });

    if (error) {
      console.warn("[appUsageService] recordUsageHeartbeat failed:", summarizeErrorForLog(error));
      return false;
    }

    return !!data;
  } catch (error) {
    console.warn("[appUsageService] recordUsageHeartbeat exception:", summarizeErrorForLog(error));
    return false;
  }
}

export async function recordUsageAction(input: AppUsageActionInput = {}): Promise<boolean> {
  const actionCount = clampInteger(input.actionCount, 1, 0, 1000);
  const createdRecordsCount = clampInteger(input.createdRecordsCount, 0, 0, 10000);
  const updatedRecordsCount = clampInteger(input.updatedRecordsCount, 0, 0, 10000);
  const deletedRecordsCount = clampInteger(input.deletedRecordsCount, 0, 0, 10000);
  const uploadedBytes = clampInteger(input.uploadedBytes, 0, 0, 10_737_418_240);

  try {
    const { data, error } = await supabase.rpc("record_usage_action", {
      action_count_input: actionCount,
      created_records_count_input: createdRecordsCount,
      updated_records_count_input: updatedRecordsCount,
      deleted_records_count_input: deletedRecordsCount,
      uploaded_bytes_input: uploadedBytes,
    });

    if (error) {
      console.warn("[appUsageService] recordUsageAction failed:", summarizeErrorForLog(error));
      return false;
    }

    return !!data;
  } catch (error) {
    console.warn("[appUsageService] recordUsageAction exception:", summarizeErrorForLog(error));
    return false;
  }
}

export async function getAppUsageSummaryAdmin(
  daysBack: number = 30,
  organizationId?: string | null,
): Promise<AppUsageSummaryItem[]> {
  const normalizedDays = clampInteger(daysBack, 30, 1, 365);
  const { data, error } = await supabase.rpc("get_app_usage_summary_admin", {
    days_back: normalizedDays,
    target_organization_id: organizationId || null,
  });

  if (error) {
    throw error;
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    organizationId: String(row.organization_id ?? ""),
    organizationName: String(row.organization_name ?? ""),
    userId: String(row.user_id ?? ""),
    email: String(row.email ?? ""),
    displayName: row.display_name ? String(row.display_name) : null,
    activeSeconds: normalizeNumber(row.active_seconds),
    activeDays: normalizeNumber(row.active_days),
    sessionCount: normalizeNumber(row.session_count),
    actionCount: normalizeNumber(row.action_count),
    uploadedBytes: normalizeNumber(row.uploaded_bytes),
    createdRecordsCount: normalizeNumber(row.created_records_count),
    updatedRecordsCount: normalizeNumber(row.updated_records_count),
    deletedRecordsCount: normalizeNumber(row.deleted_records_count),
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
    dailyStats: normalizeDailyStats(row.daily_stats),
  }));
}
