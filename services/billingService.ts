/**
 * Billing Service - Payment Gateway Integration
 * 
 * This is a skeleton service prepared for future Stripe (or other payment gateway) integration.
 * Currently contains placeholder methods that will be implemented when billing is set up.
 */

import { invokeAuthedFunction } from './functionsClient';

// Types for billing operations
export interface CheckoutSessionRequest {
    tier: 'starter' | 'pro' | 'enterprise';
    successUrl: string;
    cancelUrl: string;
    billingPeriod?: 'monthly' | 'yearly';
}

export interface CheckoutSessionResponse {
    success: boolean;
    checkoutUrl?: string;
    sessionId?: string;
    error?: string;
}

export interface BillingPortalResponse {
    success: boolean;
    portalUrl?: string;
    error?: string;
}

export interface WebhookEvent {
    type: string;
    data: {
        object: any;
    };
}

export interface WebhookResult {
    received: boolean;
    processed: boolean;
    error?: string;
}

// Pricing configuration (can be moved to environment or database)
export const PRICING_CONFIG = {
    starter: {
        monthlyPrice: 35000, // In cents (CZK) = 350 Kč
        yearlyPrice: 336000, // 3360 Kč (20% discount)
        stripePriceIdMonthly: import.meta.env.VITE_STRIPE_PRICE_ID_STARTER_MONTHLY || '',
        stripePriceIdYearly: import.meta.env.VITE_STRIPE_PRICE_ID_STARTER_YEARLY || '',
    },
    pro: {
        monthlyPrice: 49900, // In cents (CZK) = 499 Kč
        yearlyPrice: 479000, // 4790 Kč (20% discount)
        stripePriceIdMonthly: import.meta.env.VITE_STRIPE_PRICE_ID_PRO_MONTHLY || '',
        stripePriceIdYearly: import.meta.env.VITE_STRIPE_PRICE_ID_PRO_YEARLY || '',
    },
    enterprise: {
        monthlyPrice: null, // Custom pricing
        yearlyPrice: null,
        stripePriceIdMonthly: import.meta.env.VITE_STRIPE_PRICE_ID_ENTERPRISE_MONTHLY || '',
        stripePriceIdYearly: import.meta.env.VITE_STRIPE_PRICE_ID_ENTERPRISE_YEARLY || '',
    },
};

export const billingService = {
    /**
     * Create a Stripe Checkout session for subscription purchase.
     * 
     * TODO: Implement when Stripe is integrated
     */
    createCheckoutSession: async (
        request: CheckoutSessionRequest
    ): Promise<CheckoutSessionResponse> => {
        try {
            return await invokeAuthedFunction<CheckoutSessionResponse>(
                'stripe-create-checkout-session',
                { body: request },
            );
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Platební brána není dostupná.',
            };
        }
    },

    /**
     * Create a Stripe Billing Portal session for subscription management.
     * Allows customers to update payment methods, view invoices, cancel, etc.
     * 
     * TODO: Implement when Stripe is integrated
     */
    createBillingPortalSession: async (options?: {
        returnUrl?: string;
    }): Promise<BillingPortalResponse> => {
        try {
            return await invokeAuthedFunction<BillingPortalResponse>(
                'stripe-create-billing-portal-session',
                { body: options ?? {} },
            );
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Platební brána není dostupná.',
            };
        }
    },

    /**
     * Force sync subscription data from Stripe.
     * Use when webhook data is stale or missing.
     */
    syncSubscription: async (): Promise<{
        success: boolean;
        message?: string;
        subscription?: {
            id: string;
            tier: string;
            status: string;
            expiresAt: string | null;
            cancelAtPeriodEnd: boolean;
        } | null;
        error?: string;
    }> => {
        try {
            return await invokeAuthedFunction(
                'stripe-sync-subscription',
                { body: {} },
            );
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Synchronizace selhala.',
            };
        }
    },

    /**
     * Handle incoming webhook events from payment provider.
     * This should be called from a Supabase Edge Function that receives webhooks.
     * 
     * Common events to handle:
     * - checkout.session.completed: Customer completed payment
     * - customer.subscription.updated: Subscription changed
     * - customer.subscription.deleted: Subscription cancelled
     * - invoice.payment_failed: Payment failed
     * 
     * TODO: Implement webhook handler Edge Function
     */
    handleWebhook: async (_event: WebhookEvent): Promise<WebhookResult> => {
        console.warn('Billing not configured: handleWebhook called');
        return {
            received: true,
            processed: false,
            error: 'Webhook handler not implemented',
        };
    },

    /**
     * Check if billing is properly configured.
     */
    isBillingConfigured: (): boolean => {
        // Check for Stripe price IDs or other billing config
        return [
            PRICING_CONFIG.starter.stripePriceIdMonthly,
            PRICING_CONFIG.starter.stripePriceIdYearly,
            PRICING_CONFIG.pro.stripePriceIdMonthly,
            PRICING_CONFIG.pro.stripePriceIdYearly,
            PRICING_CONFIG.enterprise.stripePriceIdMonthly,
            PRICING_CONFIG.enterprise.stripePriceIdYearly,
        ].some(Boolean);
    },

    /**
     * Get formatted price for display.
     */
    formatPrice: (priceInCents: number | null): string => {
        if (priceInCents === null) return 'Na míru';
        return new Intl.NumberFormat('cs-CZ', {
            style: 'currency',
            currency: 'CZK',
            maximumFractionDigits: 0,
        }).format(priceInCents / 100);
    },
};
