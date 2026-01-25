/**
 * Subscription Tiers Configuration
 * Single source of truth for all subscription tier definitions.
 * 
 * Usage:
 * - `id`: Internal identifier (used in DB, check constraints, code)
 * - `label`: Display name in UI
 * - `badgeClass`: Tailwind classes for tier badge styling
 * - `sortOrder`: Display order in UI (lower = first)
 */

export interface TierConfig {
  id: SubscriptionTierId;
  label: string;
  badgeClass: string;
  sortOrder: number;
  isVisible: boolean; // Whether to show in admin tier matrix
}

// Internal tier IDs (must match DB check constraint)
export type SubscriptionTierId = 'free' | 'starter' | 'pro' | 'enterprise' | 'admin';

/**
 * All subscription tiers with their configuration
 */
export const SUBSCRIPTION_TIERS: Record<SubscriptionTierId, TierConfig> = {
  free: {
    id: 'free',
    label: 'Free',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    sortOrder: 0,
    isVisible: true,
  },
  starter: {
    id: 'starter',
    label: 'Starter',
    badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    sortOrder: 1,
    isVisible: true,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    badgeClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    sortOrder: 2,
    isVisible: true,
  },
  enterprise: {
    id: 'enterprise',
    label: 'Enterprise',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    sortOrder: 3,
    isVisible: true,
  },
  admin: {
    id: 'admin',
    label: 'Admin',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    sortOrder: 4,
    isVisible: false, // Admin tier is implicit, not shown in matrix
  },
};

/**
 * Get tiers for display in admin UI (sorted, filtered by isVisible)
 */
export const getDisplayTiers = (): TierConfig[] => {
  return Object.values(SUBSCRIPTION_TIERS)
    .filter((t) => t.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder);
};

/**
 * Get all tiers including admin (for internal operations)
 */
export const getAllTiers = (): TierConfig[] => {
  return Object.values(SUBSCRIPTION_TIERS).sort((a, b) => a.sortOrder - b.sortOrder);
};

/**
 * Get tier label by ID
 */
export const getTierLabel = (tierId: SubscriptionTierId): string => {
  return SUBSCRIPTION_TIERS[tierId]?.label || tierId;
};

/**
 * Get tier badge class by ID
 */
export const getTierBadgeClass = (tierId: SubscriptionTierId): string => {
  return SUBSCRIPTION_TIERS[tierId]?.badgeClass || '';
};

/**
 * Check if tier ID is valid
 */
export const isValidTierId = (id: string): id is SubscriptionTierId => {
  return id in SUBSCRIPTION_TIERS;
};
