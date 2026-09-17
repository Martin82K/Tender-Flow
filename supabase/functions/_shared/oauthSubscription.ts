interface SubscriptionRpcClient {
  rpc(name: string, args: Record<string, string>): PromiseLike<{ data: unknown; error: unknown }>;
}

/** State comes from the atomically consumed server-side OAuth record. */
export const hasOAuthStateSubscription = async (
  client: SubscriptionRpcClient,
  state: { user_id: string; project_id: string | null },
  requiresProject: boolean,
): Promise<boolean> => {
  if (!state.user_id || (requiresProject && !state.project_id)) return false;
  try {
    if (state.project_id) {
      const { data, error } = await client.rpc('has_project_subscription_for_user', {
        project_id_input: state.project_id,
        user_id_input: state.user_id,
      });
      return !error && data === true;
    }
    // Global personal Microsoft grants have no tenant resource to authorize.
    const { data, error } = await client.rpc('get_effective_user_tier', { target_user_id: state.user_id });
    return !error && typeof data === 'object' && data !== null && 'tier' in data
      && typeof data.tier === 'string' && ['starter', 'pro', 'enterprise', 'admin'].includes(data.tier);
  } catch {
    return false;
  }
};
