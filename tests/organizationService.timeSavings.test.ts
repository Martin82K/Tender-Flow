import { beforeEach, describe, expect, it, vi } from 'vitest';
import { organizationService } from '../services/organizationService';

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    rpc: supabaseMocks.rpc,
  },
}));

describe('organizationService.getOrganizationUnlockerTimeSavings', () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset();
  });

  it('volá RPC se správnými parametry a vrací první řádek', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        {
          organization_id: 'org-1',
          organization_name: 'Tenant One',
          unlocked_sheets_total: 12,
          unlocked_sheets_range: 4,
          unlock_events_total: 3,
          unlock_events_range: 2,
          minutes_saved_total: 24,
          minutes_saved_range: 8,
          last_unlock_at: '2026-02-07T12:00:00.000Z',
        },
      ],
      error: null,
    });

    const result = await organizationService.getOrganizationUnlockerTimeSavings('org-1', 30, 2);

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_org_unlocker_time_savings', {
      org_id_input: 'org-1',
      days_back: 30,
      minutes_per_sheet: 2,
    });
    expect(result?.organization_id).toBe('org-1');
    expect(result?.minutes_saved_total).toBe(24);
  });

  it('při chybě propaguje message z RPC', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Access denied' },
    });

    await expect(
      organizationService.getOrganizationUnlockerTimeSavings('org-1'),
    ).rejects.toThrow('Access denied');
  });
});
