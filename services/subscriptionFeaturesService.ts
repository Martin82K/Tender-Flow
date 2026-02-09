import { supabase } from './supabase';
import { getCachedSubscriptionTier } from './authService';
import { SubscriptionFeature, SubscriptionTier, SubscriptionTierFeatureFlag } from '../types';

export const subscriptionFeaturesService = {
  listFeatures: async (): Promise<SubscriptionFeature[]> => {
    const { data, error } = await supabase
      .from('subscription_features')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      key: row.key,
      name: row.name,
      description: row.description,
      category: row.category,
      sortOrder: row.sort_order ?? 0,
    }));
  },

  listTierFlags: async (): Promise<SubscriptionTierFeatureFlag[]> => {
    const { data, error } = await supabase.from('subscription_tier_features').select('*');
    if (error) throw error;

    return (data || []).map((row: any) => ({
      tier: row.tier as SubscriptionTier,
      featureKey: row.feature_key as string,
      enabled: !!row.enabled,
    }));
  },

  setTierFlag: async (tier: SubscriptionTier, featureKey: string, enabled: boolean): Promise<void> => {
    const { error } = await supabase
      .from('subscription_tier_features')
      .upsert(
        { tier, feature_key: featureKey, enabled, updated_at: new Date().toISOString() },
        { onConflict: 'tier,feature_key' }
      );

    if (error) throw error;
  },

  createFeature: async (feature: {
    key: string;
    name: string;
    description?: string;
    category?: string;
    sortOrder?: number;
  }): Promise<void> => {
    const payload: any = {
      key: feature.key,
      name: feature.name,
      description: feature.description || null,
      category: feature.category || null,
      sort_order: feature.sortOrder ?? 0,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('subscription_features').insert(payload);
    if (error) throw error;
  },

  updateFeature: async (
    key: string,
    updates: Partial<Pick<SubscriptionFeature, 'name' | 'description' | 'category' | 'sortOrder'>>
  ): Promise<void> => {
    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

    const { error } = await supabase.from('subscription_features').update(payload).eq('key', key);
    if (error) throw error;
  },

  deleteFeature: async (key: string): Promise<void> => {
    const { error } = await supabase.from('subscription_features').delete().eq('key', key);
    if (error) throw error;
  },

  // ============================================================================
  // Backend Feature Checking (uses RPC functions for secure server-side validation)
  // ============================================================================

  /**
   * Get all features enabled for the current user based on their subscription tier.
   * This calls the backend RPC which cannot be bypassed.
   */
  getUserEnabledFeatures: async (): Promise<{ key: string; name: string; description: string | null; category: string | null }[]> => {
    const { data, error } = await supabase.rpc('get_user_enabled_features');
    if (error) throw error;
    return (data || []).map((row: any) => ({
      key: row.feature_key,
      name: row.feature_name,
      description: row.feature_description,
      category: row.feature_category,
    }));
  },

  /**
   * Check if current user has access to a specific feature.
   * Returns tier info and access status from the backend.
   */
  checkFeatureAccess: async (featureKey: string): Promise<{ feature: string; tier: string; hasAccess: boolean }> => {
    const { data, error } = await supabase.rpc('check_feature_access', { feature_key: featureKey });
    if (error) throw error;
    return {
      feature: data?.feature || featureKey,
      tier: data?.tier || 'free',
      hasAccess: data?.hasAccess || false,
    };
  },

  /**
   * Get current user's effective subscription tier from the backend.
   * Falls back to cached tier on error to prevent tier downgrade.
   */
  getUserSubscriptionTier: async (): Promise<string> => {
    try {
      const userResult = await supabase.auth.getUser();
      const userId = userResult.data.user?.id;
      console.log('[subscriptionFeaturesService] getUserSubscriptionTier: userId =', userId);

      if (!userId) {
        console.warn('[subscriptionFeaturesService] getUserSubscriptionTier: No user ID, checking cache');
        const cachedTier = getCachedSubscriptionTier();
        return cachedTier || 'free';
      }

      const { data, error } = await supabase.rpc('get_user_subscription_tier', { target_user_id: userId });
      console.log('[subscriptionFeaturesService] getUserSubscriptionTier: RPC result =', { data, error });

      if (error) {
        console.error('[subscriptionFeaturesService] getUserSubscriptionTier: RPC error =', error);
        // Use cached tier on error to prevent downgrade
        const cachedTier = getCachedSubscriptionTier();
        if (cachedTier) {
          console.log('[subscriptionFeaturesService] Using cached tier due to RPC error:', cachedTier);
          return cachedTier;
        }
        return 'free';
      }

      const tier = data || 'free';
      console.log('[subscriptionFeaturesService] getUserSubscriptionTier: returning tier =', tier);
      return tier;
    } catch (e) {
      console.error('[subscriptionFeaturesService] getUserSubscriptionTier: exception =', e);
      // Use cached tier on exception to prevent downgrade
      const cachedTier = getCachedSubscriptionTier();
      if (cachedTier) {
        console.log('[subscriptionFeaturesService] Using cached tier due to exception:', cachedTier);
        return cachedTier;
      }
      return 'free';
    }
  },
};


