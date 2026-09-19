import { describe, expect, it, vi } from 'vitest';
import { hasOAuthStateSubscription } from '../supabase/functions/_shared/oauthSubscription';

const state = { user_id: 'user', project_id: 'expired-company-project' };
describe('OAuth subscription resource boundary', () => {
  it('rejects an expired project without falling back to another organization licence', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    expect(await hasOAuthStateSubscription({ rpc }, state, true)).toBe(false);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('has_project_subscription_for_user', {
      project_id_input: state.project_id, user_id_input: state.user_id,
    });
  });
  it('permits a licensed project and scopes personal read grants that reference a project', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    expect(await hasOAuthStateSubscription({ rpc }, state, false)).toBe(true);
    expect(rpc).toHaveBeenCalledWith('has_project_subscription_for_user', expect.any(Object));
  });
  it('preserves global personal Microsoft grants', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { tier: 'pro' }, error: null });
    expect(await hasOAuthStateSubscription({ rpc }, { ...state, project_id: null }, false)).toBe(true);
    expect(rpc).toHaveBeenCalledWith('get_effective_user_tier', { target_user_id: 'user' });
  });
  it('rejects a missing project for project management', async () => {
    const rpc = vi.fn();
    expect(await hasOAuthStateSubscription({ rpc }, { ...state, project_id: null }, true)).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([null, 'true', { tier: 'enterprise' }])('rejects invalid project responses %j', async (data) => {
    const rpc = vi.fn().mockResolvedValue({ data, error: null });
    expect(await hasOAuthStateSubscription({ rpc }, state, true)).toBe(false);
  });
  it('fails closed on transport and RPC failures', async () => {
    const rpc = vi.fn().mockRejectedValue(new Error('private failure'));
    expect(await hasOAuthStateSubscription({ rpc }, state, true)).toBe(false);
    rpc.mockResolvedValue({ data: true, error: { message: 'failed' } });
    expect(await hasOAuthStateSubscription({ rpc }, state, true)).toBe(false);
  });
});
