import { supabase } from './supabase';

export interface UsageTenantOption {
  organizationId: string;
  organizationName: string;
}

export interface FeatureUsageDailyCount {
  date: string;
  count: number;
}

export interface FeatureUsageSummaryItem {
  featureKey: string;
  featureName: string;
  totalCount: number;
  rangeCount: number;
  lastUsedAt: string | null;
  dailyCounts: FeatureUsageDailyCount[];
}

const normalizeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDailyCounts = (value: unknown): FeatureUsageDailyCount[] => {
  if (!Array.isArray(value)) return [];

  return value.map((entry) => {
    const row = entry as Record<string, unknown>;
    return {
      date: String(row.date ?? ''),
      count: normalizeNumber(row.count),
    };
  });
};

export async function trackFeatureUsage(
  featureKey: string,
  metadata: Record<string, unknown> = {},
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('track_feature_usage', {
      feature_key_input: featureKey,
      metadata_input: metadata,
    });

    if (error) {
      console.warn('[featureUsageService] trackFeatureUsage failed:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.warn('[featureUsageService] trackFeatureUsage exception:', error);
    return false;
  }
}

export async function getUsageTenantsAdmin(): Promise<UsageTenantOption[]> {
  const { data, error } = await supabase.rpc('get_feature_usage_tenants_admin');

  if (error) {
    throw error;
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    organizationId: String(row.organization_id ?? ''),
    organizationName: String(row.organization_name ?? ''),
  }));
}

export async function getFeatureUsageSummaryAdmin(
  organizationId: string,
  daysBack: number = 30,
): Promise<FeatureUsageSummaryItem[]> {
  const { data, error } = await supabase.rpc('get_feature_usage_summary_admin', {
    target_organization_id: organizationId,
    days_back: daysBack,
  });

  if (error) {
    throw error;
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    featureKey: String(row.feature_key ?? ''),
    featureName: String(row.feature_name ?? ''),
    totalCount: normalizeNumber(row.total_count),
    rangeCount: normalizeNumber(row.range_count),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    dailyCounts: normalizeDailyCounts(row.daily_counts),
  }));
}
