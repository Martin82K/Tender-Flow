/**
 * Organization Billing & Subscription Types
 *
 * Types for the org-level subscription model where the organization
 * owns the subscription plan and members inherit feature access.
 */

import type { SubscriptionTierId } from '@/config/subscriptionTiers';

/** Organization subscription info (read from organizations table) */
export interface OrgSubscriptionInfo {
  orgId: string;
  orgName: string;
  tier: SubscriptionTierId;
  status: 'trial' | 'active' | 'past_due' | 'paused' | 'canceled' | 'cancelled' | 'expired' | 'pending';
  maxSeats: number;
  usedSeats: number;
  billingPeriod: 'monthly' | 'yearly';
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  billingContact: string | null;
  billingCustomerId: string | null;
  expiresAt: string | null;
  /** Override fields (admin-granted tier upgrade) */
  overrideTier: SubscriptionTierId | null;
  overrideExpiresAt: string | null;
  overrideReason: string | null;
}

/** Billing history entry for an organization */
export interface OrgBillingHistoryEntry {
  id: string;
  organizationId: string;
  amount: number;
  currency: string;
  seatsCount: number | null;
  tier: string | null;
  gopayPaymentId: string | null;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt: string;
}

/** Organization member with seat info */
export interface OrgMemberSeat {
  userId: string;
  email: string;
  displayName: string | null;
  role: 'owner' | 'admin' | 'member';
  seatType: 'full' | 'guest';
  isBillable: boolean;
  isActive: boolean;
  joinedAt: string;
}

/** Seat usage summary */
export interface OrgSeatUsage {
  maxSeats: number;
  usedSeats: number;
  billableSeats: number;
  availableSeats: number;
}

/** Result of get_effective_user_tier RPC */
export interface EffectiveTierResult {
  tier: string;
  source: 'org_override' | 'org_subscription' | 'user_legacy' | 'default';
}

/** Per-user feature override */
export interface UserFeatureOverride {
  id: string;
  userId: string;
  featureKey: string;
  grantedBy: string | null;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** Organization sub-tab identifiers */
export type OrgSubTab = 'overview' | 'members' | 'billing' | 'branding';
