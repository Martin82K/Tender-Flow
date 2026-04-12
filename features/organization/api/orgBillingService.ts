/**
 * Organization Billing Service
 *
 * Data access layer for org-level subscription, seat usage, and billing history.
 * Routes through infra/org-billing to avoid direct supabase imports in features/.
 */

import { orgSubscriptionRpc } from '@/infra/org-billing/orgSubscriptionRpc';
import type {
  OrgSubscriptionInfo,
  OrgBillingHistoryEntry,
  OrgSeatUsage,
  OrgMemberSeat,
} from '../model/types';

/**
 * Get organization subscription info including override details.
 */
export const getOrgSubscription = async (orgId: string): Promise<OrgSubscriptionInfo | null> => {
  const data = await orgSubscriptionRpc.getOrgSubscription(orgId);
  if (!data) return null;

  const billableCount = await orgSubscriptionRpc.countBillableMembers(orgId);

  return {
    orgId: data.id,
    orgName: data.name,
    tier: data.subscription_tier || 'free',
    status: data.subscription_status || 'active',
    maxSeats: data.max_seats || 1,
    usedSeats: billableCount,
    billingPeriod: data.billing_period || 'monthly',
    billingCustomerId: data.billing_customer_id,
    expiresAt: data.expires_at,
    overrideTier: data.override_tier,
    overrideExpiresAt: data.override_expires_at,
    overrideReason: data.override_reason,
  };
};

/**
 * Get billing history for an organization.
 */
export const getOrgBillingHistory = async (
  orgId: string,
  limit = 20,
): Promise<OrgBillingHistoryEntry[]> => {
  const data = await orgSubscriptionRpc.getOrgBillingHistory(orgId, limit);

  return data.map((row: any) => ({
    id: row.id,
    organizationId: row.organization_id,
    amount: row.amount,
    currency: row.currency || 'CZK',
    seatsCount: row.seats_count,
    tier: row.tier,
    gopayPaymentId: row.gopay_payment_id,
    status: row.status,
    createdAt: row.created_at,
  }));
};

/**
 * Get seat usage summary for an organization.
 */
export const getOrgSeatUsage = async (orgId: string): Promise<OrgSeatUsage> => {
  const [maxSeats, billableCount, totalCount] = await Promise.all([
    orgSubscriptionRpc.getMaxSeats(orgId),
    orgSubscriptionRpc.countBillableMembers(orgId),
    orgSubscriptionRpc.countTotalMembers(orgId),
  ]);

  return {
    maxSeats,
    usedSeats: totalCount,
    billableSeats: billableCount,
    availableSeats: Math.max(0, maxSeats - billableCount),
  };
};

/**
 * Get organization members with seat info.
 */
export const getOrgMembersWithSeats = async (orgId: string): Promise<OrgMemberSeat[]> => {
  const members = await orgSubscriptionRpc.getOrgMemberSeats(orgId);
  const userIds = members.map((m: any) => m.user_id);
  const profiles = await orgSubscriptionRpc.getUserProfiles(userIds);

  const profileMap = new Map(
    profiles.map((p: any) => [p.user_id, p]),
  );

  return members.map((m: any) => {
    const profile = profileMap.get(m.user_id) as any;
    return {
      userId: m.user_id,
      email: profile?.email || '',
      displayName: profile?.display_name || null,
      role: m.role,
      seatType: m.seat_type || 'full',
      isBillable: m.is_billable ?? true,
      joinedAt: m.created_at,
    };
  });
};
