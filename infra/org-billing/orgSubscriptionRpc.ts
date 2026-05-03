/**
 * Infrastructure layer: Org Subscription RPC calls
 *
 * Wraps Supabase RPC calls for org-level subscription billing.
 * This lives in infra/ so that features/ doesn't import supabase directly.
 */

import { supabase } from '@/services/supabase';
import type { EffectiveTierResult } from '@/features/organization/model/types';

export const orgSubscriptionRpc = {
  /**
   * Get effective user tier (org-level with override support).
   */
  getEffectiveUserTier: async (): Promise<EffectiveTierResult> => {
    const userResult = await supabase.auth.getUser();
    const userId = userResult.data.user?.id;
    if (!userId) throw new Error('No authenticated user');

    const { data, error } = await supabase.rpc('get_effective_user_tier', {
      target_user_id: userId,
    });

    if (error) {
      // Throw so FeatureContext can fall back to v1 RPCs
      throw error;
    }

    return {
      tier: data?.tier || 'free',
      source: data?.source || 'default',
    };
  },

  /**
   * Get enabled features v2 (org-aware + per-user overrides).
   */
  getEnabledFeaturesV2: async (): Promise<
    { key: string; name: string; description: string | null; category: string | null }[]
  > => {
    const { data, error } = await supabase.rpc('get_user_enabled_features_v2');
    if (error) {
      // Throw so FeatureContext can fall back to v1 RPCs
      throw error;
    }
    return (data || []).map((row: any) => ({
      key: row.feature_key,
      name: row.feature_name,
      description: row.feature_description,
      category: row.feature_category,
    }));
  },

  /**
   * Get organization subscription info.
   */
  getOrgSubscription: async (orgId: string) => {
    const { data, error } = await supabase
      .from('organizations')
      .select(`
        id, name, subscription_tier, subscription_status, max_seats,
        billing_customer_id, billing_period, billing_period_start, billing_period_end,
        billing_contact, expires_at,
        override_tier, override_expires_at, override_reason
      `)
      .eq('id', orgId)
      .single();

    if (error) return null;
    return data;
  },

  /**
   * Get org billing history.
   */
  getOrgBillingHistory: async (orgId: string, limit = 20) => {
    const { data, error } = await supabase
      .from('org_billing_history')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  /**
   * Count billable members.
   */
  countBillableMembers: async (orgId: string): Promise<number> => {
    const { count } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_billable', true)
      .eq('is_active', true);
    return count || 0;
  },

  /**
   * Count total active members.
   */
  countTotalMembers: async (orgId: string): Promise<number> => {
    const { count } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_active', true);
    return count || 0;
  },

  /**
   * Get org max seats.
   */
  getMaxSeats: async (orgId: string): Promise<number> => {
    const { data } = await supabase
      .from('organizations')
      .select('max_seats')
      .eq('id', orgId)
      .single();
    return data?.max_seats || 1;
  },

  /**
   * Get member seat details.
   */
  getOrgMemberSeats: async (orgId: string) => {
    const { data, error } = await supabase
      .from('organization_members')
      .select('user_id, role, seat_type, is_billable, is_active, created_at')
      .eq('organization_id', orgId);

    if (error) throw error;
    return data || [];
  },

  /**
   * Get user profiles by IDs.
   */
  getUserProfiles: async (userIds: string[]) => {
    if (userIds.length === 0) return [];
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id, email, display_name')
      .in('user_id', userIds);
    return data || [];
  },

  /**
   * Owner: Update max seats for an organization.
   */
  updateOrgSeats: async (orgId: string, newMaxSeats: number): Promise<void> => {
    const { error } = await supabase.rpc('org_owner_update_seats', {
      target_org_id: orgId,
      new_max_seats: newMaxSeats,
    });
    if (error) throw error;
  },

  /**
   * Admin: Get all organizations with subscription & seat info.
   */
  getAllOrganizationsAdmin: async () => {
    const { data, error } = await supabase.rpc('get_all_organizations_admin');
    if (error) throw error;
    return (data || []) as {
      org_id: string;
      org_name: string;
      subscription_tier: string | null;
      subscription_status: string | null;
      max_seats: number;
      billable_seats: number;
      total_members: number;
      billing_period: string | null;
      billing_period_start: string | null;
      billing_period_end: string | null;
      billing_contact: string | null;
      expires_at: string | null;
      override_tier: string | null;
      override_expires_at: string | null;
      override_reason: string | null;
      created_at: string;
    }[];
  },

  /**
   * Admin: Update organization subscription tier and max seats.
   */
  adminUpdateOrgSubscription: async (
    orgId: string,
    tier: string | null,
    maxSeats: number | null,
    reason: string | null,
    status?: string | null,
    billingPeriod?: string | null,
    billingPeriodStart?: string | null,
    billingPeriodEnd?: string | null,
    billingContact?: string | null,
  ) => {
    const { error } = await supabase.rpc('admin_update_org_subscription', {
      target_org_id: orgId,
      new_tier: tier,
      new_max_seats: maxSeats,
      p_reason: reason,
      new_status: status ?? null,
      new_billing_period: billingPeriod ?? null,
      new_billing_period_start: billingPeriodStart || null,
      new_billing_period_end: billingPeriodEnd || null,
      new_billing_contact: billingContact ?? null,
    });
    if (error) throw error;
  },
};
