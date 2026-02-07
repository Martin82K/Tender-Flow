import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getFeatureUsageSummaryAdmin,
  getUsageTenantsAdmin,
  trackFeatureUsage,
} from '../services/featureUsageService';

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    rpc: supabaseMocks.rpc,
  },
}));

describe('featureUsageService', () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset();
  });

  it('trackFeatureUsage volá správné RPC parametry', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: true, error: null });

    const result = await trackFeatureUsage('excel_unlocker', { fileSizeBytes: 1234 });

    expect(result).toBe(true);
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('track_feature_usage', {
      feature_key_input: 'excel_unlocker',
      metadata_input: { fileSizeBytes: 1234 },
    });
  });

  it('trackFeatureUsage při chybě nepropaguje výjimku a vrátí false', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: new Error('fail') });

    await expect(trackFeatureUsage('excel_unlocker')).resolves.toBe(false);
  });

  it('getUsageTenantsAdmin normalizuje data', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        { organization_id: 'org-1', organization_name: 'Tenant A' },
        { organization_id: 'org-2', organization_name: 'Tenant B' },
      ],
      error: null,
    });

    await expect(getUsageTenantsAdmin()).resolves.toEqual([
      { organizationId: 'org-1', organizationName: 'Tenant A' },
      { organizationId: 'org-2', organizationName: 'Tenant B' },
    ]);
  });

  it('getFeatureUsageSummaryAdmin mapuje summary payload včetně dailyCounts', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        {
          feature_key: 'excel_unlocker',
          feature_name: 'Excel Unlocker PRO',
          total_count: '11',
          range_count: 4,
          last_used_at: '2026-02-07T10:20:30.000Z',
          daily_counts: [
            { date: '2026-02-06', count: '2' },
            { date: '2026-02-07', count: 1 },
          ],
        },
      ],
      error: null,
    });

    await expect(getFeatureUsageSummaryAdmin('org-1', 30)).resolves.toEqual([
      {
        featureKey: 'excel_unlocker',
        featureName: 'Excel Unlocker PRO',
        totalCount: 11,
        rangeCount: 4,
        lastUsedAt: '2026-02-07T10:20:30.000Z',
        dailyCounts: [
          { date: '2026-02-06', count: 2 },
          { date: '2026-02-07', count: 1 },
        ],
      },
    ]);

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_feature_usage_summary_admin', {
      target_organization_id: 'org-1',
      days_back: 30,
    });
  });
});
