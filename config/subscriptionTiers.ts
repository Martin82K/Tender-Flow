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
export type SubscriptionTierId = 'demo' | 'free' | 'pro' | 'enterprise' | 'admin';

/**
 * All subscription tiers with their configuration
 */
export const SUBSCRIPTION_TIERS: Record<SubscriptionTierId, TierConfig> = {
  demo: {
    id: 'demo',
    label: 'Demo',
    badgeClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/20',
    sortOrder: 0,
    isVisible: true,
  },
  free: {
    id: 'free',
    label: 'Starter',
    badgeClass: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/20',
    sortOrder: 1,
    isVisible: true,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/20',
    sortOrder: 2,
    isVisible: true,
  },
  enterprise: {
    id: 'enterprise',
    label: 'Enterprise',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    sortOrder: 3,
    isVisible: true,
  },
  admin: {
    id: 'admin',
    label: 'Admin',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/20',
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
