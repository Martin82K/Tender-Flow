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

describe('organizationService.getOrganizationMembers', () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset();
  });

  it('volá get_org_members se správným parametrem a vrací data', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        {
          user_id: 'user-1',
          email: 'user@example.com',
          display_name: 'User One',
          role: 'owner',
          joined_at: '2026-02-07T12:00:00.000Z',
        },
      ],
      error: null,
    });

    const result = await organizationService.getOrganizationMembers('org-1');

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_org_members', {
      org_id_input: 'org-1',
    });
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('user@example.com');
  });

  it('při chybě propaguje message z RPC', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'structure of query does not match function result type' },
    });

    await expect(organizationService.getOrganizationMembers('org-1')).rejects.toThrow(
      'structure of query does not match function result type',
    );
  });

  it('deduplikuje členy podle user_id a ponechá nejstarší joined_at', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        {
          user_id: 'user-1',
          email: 'user@example.com',
          display_name: 'User One',
          role: 'member',
          joined_at: '2026-02-07T12:00:00.000Z',
        },
        {
          user_id: 'user-1',
          email: 'user@example.com',
          display_name: 'User One',
          role: 'admin',
          joined_at: '2026-02-01T12:00:00.000Z',
        },
      ],
      error: null,
    });

    const result = await organizationService.getOrganizationMembers('org-1');

    expect(result).toHaveLength(1);
    expect(result[0].joined_at).toBe('2026-02-01T12:00:00.000Z');
    expect(result[0].role).toBe('admin');
  });
});
