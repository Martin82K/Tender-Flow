import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userManagementService } from '../services/userManagementService';

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    rpc: supabaseMocks.rpc,
    from: supabaseMocks.from,
  },
}));

describe('userManagementService.getAllUsers', () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset();
    supabaseMocks.from.mockReset();
  });

  it('volá get_all_users_admin a deduplikuje uživatele podle user_id', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        {
          user_id: 'user-1',
          email: 'user1@example.com',
          display_name: '',
          role_id: null,
          role_label: null,
          created_at: '2026-02-07T12:00:00.000Z',
          last_sign_in: null,
          auth_provider: 'email',
          login_type: null,
          org_subscription_tier: null,
          subscription_tier_override: null,
          effective_subscription_tier: 'free',
        },
        {
          user_id: 'user-1',
          email: 'user1@example.com',
          display_name: 'User One',
          role_id: null,
          role_label: null,
          created_at: '2026-02-07T12:00:00.000Z',
          last_sign_in: null,
          auth_provider: 'email',
          login_type: null,
          org_subscription_tier: 'pro',
          subscription_tier_override: 'enterprise',
          effective_subscription_tier: 'enterprise',
        },
      ],
      error: null,
    });

    const users = await userManagementService.getAllUsers();

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_all_users_admin');
    expect(users).toHaveLength(1);
    expect(users[0].subscription_tier_override).toBe('enterprise');
    expect(users[0].org_subscription_tier).toBe('pro');
  });

  it('při chybě propaguje message z RPC', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Access denied: Admin only' },
    });

    await expect(userManagementService.getAllUsers()).rejects.toThrow('Access denied: Admin only');
  });
});
