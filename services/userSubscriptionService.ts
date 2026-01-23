import { supabase } from './supabase';
import { SubscriptionInfo, SubscriptionTier } from '../types';

export interface UpgradeRequest {
    success: boolean;
    message: string;
    currentTier?: string;
    requestedTier?: string;
    action?: 'pending_payment' | 'admin_approval' | 'checkout';
    checkoutUrl?: string;
}

export interface CancelResult {
    success: boolean;
    message?: string;
    error?: string;
}

export const userSubscriptionService = {
    /**
     * Get the current user's full subscription status including expiration info.
     */
    getSubscriptionStatus: async (): Promise<SubscriptionInfo> => {
        const { data, error } = await supabase.rpc('get_user_subscription_status');

        if (error) {
            console.error('Failed to get subscription status:', error);
            // Return default free status on error
            return {
                tier: 'free',
                effectiveTier: 'free',
                status: 'active',
                expiresAt: null,
                startedAt: null,
                trialEndsAt: null,
                cancelAtPeriodEnd: false,
                billingCustomerId: null,
                billingProvider: null,
                daysRemaining: null,
            };
        }

        return {
            tier: data?.tier || 'free',
            effectiveTier: data?.effectiveTier || 'free',
            status: data?.status || 'active',
            expiresAt: data?.expiresAt || null,
            startedAt: data?.startedAt || null,
            trialEndsAt: data?.trialEndsAt || null,
            cancelAtPeriodEnd: data?.cancelAtPeriodEnd || false,
            billingCustomerId: data?.billingCustomerId || null,
            billingProvider: data?.billingProvider || null,
            daysRemaining: data?.daysRemaining ?? null,
        };
    },

    /**
     * Request an upgrade to a different tier.
     * Returns info about next steps (payment, admin approval, etc.)
     */
    requestTierUpgrade: async (tier: SubscriptionTier): Promise<UpgradeRequest> => {
        const { data, error } = await supabase.rpc('request_tier_upgrade', {
            requested_tier: tier,
        });

        if (error) {
            return {
                success: false,
                message: error.message || 'Failed to request upgrade',
            };
        }

        return {
            success: data?.success || false,
            message: data?.message || '',
            currentTier: data?.currentTier,
            requestedTier: data?.requestedTier,
            action: data?.action,
        };
    },

    /**
     * Cancel the current subscription.
     * Subscription remains active until the end of the billing period.
     */
    cancelSubscription: async (): Promise<CancelResult> => {
        const { data, error } = await supabase.rpc('cancel_subscription');

        if (error) {
            return {
                success: false,
                error: error.message || 'Failed to cancel subscription',
            };
        }

        return {
            success: data?.success || false,
            message: data?.message,
            error: data?.error,
        };
    },

    /**
     * Reactivate a cancelled subscription (if not yet expired).
     */
    reactivateSubscription: async (): Promise<CancelResult> => {
        const { data, error } = await supabase.rpc('reactivate_subscription');

        if (error) {
            return {
                success: false,
                error: error.message || 'Failed to reactivate subscription',
            };
        }

        return {
            success: data?.success || false,
            message: data?.message,
            error: data?.error,
        };
    },

    /**
     * Calculate trial days remaining from a trial end date.
     */
    getTrialDaysRemaining: (trialEndsAt: string | null): number | null => {
        if (!trialEndsAt) return null;

        const endDate = new Date(trialEndsAt);
        const now = new Date();
        const diffMs = endDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        return Math.max(0, diffDays);
    },

    /**
     * Format expiration date for display.
     */
    formatExpirationDate: (expiresAt: string | null): string => {
        if (!expiresAt) return 'Neomezeno';

        const date = new Date(expiresAt);
        return date.toLocaleDateString('cs-CZ', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    },

    /**
     * Check if subscription is about to expire (within 7 days).
     */
    isExpiringSoon: (expiresAt: string | null): boolean => {
        if (!expiresAt) return false;

        const endDate = new Date(expiresAt);
        const now = new Date();
        const diffMs = endDate.getTime() - now.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        return diffDays > 0 && diffDays <= 7;
    },
};
