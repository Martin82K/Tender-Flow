import { supabase } from './supabase';
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
};
