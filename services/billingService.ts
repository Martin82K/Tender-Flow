/**
 * Billing Service - Payment Gateway Integration
 * 
 * This is a skeleton service prepared for future Stripe (or other payment gateway) integration.
 * Currently contains placeholder methods that will be implemented when billing is set up.
 */

import { invokeAuthedFunction } from './functionsClient';
import type { SubscriptionTier } from '@/types';

// Types for billing operations
export interface CheckoutSessionRequest {
    tier: 'starter' | 'pro' | 'enterprise';
    successUrl: string;
    cancelUrl: string;
    billingPeriod?: 'monthly' | 'yearly';
    paymentMethodPreference?: 'auto' | 'wallet_first';
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

export interface CreateSetupIntentResponse {
    success: boolean;
    customerId?: string;
    clientSecret?: string | null;
    setupIntentId?: string;
    error?: string;
}

export interface CreateSubscriptionFromPaymentMethodRequest {
    tier: 'starter' | 'pro' | 'enterprise';
    billingPeriod?: 'monthly' | 'yearly';
    paymentMethodId: string;
    idempotencyKey: string;
}

export interface CreateSubscriptionFromPaymentMethodResponse {
    success: boolean;
    subscriptionId?: string;
    status?: string;
    requiresAction?: boolean;
    paymentIntentClientSecret?: string | null;
    message?: string;
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

const normalizeErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
};

const mapBillingErrorToUserMessage = (rawError?: string): string => {
    const normalized = (rawError || '').toLowerCase();
    if (!normalized) return 'Platební brána není dostupná.';

    if (
        normalized.includes('missing stripe_secret_key') ||
        normalized.includes('not configured') ||
        normalized.includes('price id')
    ) {
        return 'Platební brána není správně nakonfigurovaná. Kontaktujte prosím podporu.';
    }

    if (normalized.includes('redirect url is not allowed')) {
        return 'Neplatná návratová URL platby. Obnovte stránku a zkuste to znovu.';
    }

    if (normalized.includes('unauthorized') || normalized.includes('nejste přihlášen')) {
        return 'Vaše relace vypršela. Přihlaste se znovu a opakujte akci.';
    }

    if (normalized.includes('payment method') && normalized.includes('available')) {
        return 'Zvolená platební metoda není na tomto zařízení dostupná.';
    }

    if (normalized.includes('idempotency')) {
        return 'Stejná platební akce už byla zpracována. Ověřte stav předplatného.';
    }

    if (normalized.includes('request is already being processed')) {
        return 'Platba se už zpracovává. Vyčkejte prosím několik sekund.';
    }

    return rawError || 'Platební brána není dostupná.';
};

// Pricing configuration (can be moved to environment or database)
export const PRICING_CONFIG = {
    starter: {
        title: "Starter",
        monthlyPrice: 39900, // In cents (CZK) = 399 Kč
        yearlyPrice: 383040, // 3830 Kč (20% discount)
        stripePriceIdMonthly: import.meta.env.VITE_STRIPE_PRICE_ID_STARTER_MONTHLY || '',
        stripePriceIdYearly: import.meta.env.VITE_STRIPE_PRICE_ID_STARTER_YEARLY || '',
        accent: "sky",
        features: [
            "Neomezené projekty",
            "Základní přehledy",
            "Modul subdodavatelé",
            "Export do Excel",
            "Export do PDF",
            "Excel Unlocker",
        ],
        cta: {
            label: "Zaregistrovat se",
            href: "/register",
        },
    },
    pro: {
        title: "Pro",
        monthlyPrice: 49900, // In cents (CZK) = 499 Kč
        yearlyPrice: 479000, // 4790 Kč (20% discount)
        stripePriceIdMonthly: import.meta.env.VITE_STRIPE_PRICE_ID_PRO_MONTHLY || '',
        stripePriceIdYearly: import.meta.env.VITE_STRIPE_PRICE_ID_PRO_YEARLY || '',
        accent: "orange",
        featured: true,
        trialDurationDays: 14,
        features: [
            "Vše ze Starter",
            "Zaváděcí akce: Desktopová aplikace",
            "Složkomat - automatizace složek",
            "Plán výběrových řízení",
            "Importy VŘ",
            "Harmonogram měs/týden/den",
            "Modul Smlouvy",
            "Excel Merger - spojování listů excelu",
            "Archivace projektů",
            "Sdílení projektů"
        ],
        cta: {
            label: "Zaregistrovat se",
            href: "/register",
        },
    },
    enterprise: {
        title: "Enterprise",
        monthlyPrice: null, // Custom pricing
        yearlyPrice: null,
        stripePriceIdMonthly: import.meta.env.VITE_STRIPE_PRICE_ID_ENTERPRISE_MONTHLY || '',
        stripePriceIdYearly: import.meta.env.VITE_STRIPE_PRICE_ID_ENTERPRISE_YEARLY || '',
        accent: "emerald",
        features: [
            "Vše z Pro",
            "OCR Dokumenty",
            "Automatické aktualizace v aplikaci",
            "Pokročilé integrace",
            "Hodnocení dodavatelů",
            "Detailní reporty nad daty",
            "Onboarding asistence",
            "Excel Indexer - auto tvoření podkladů pro VŘ",
            "Okamžitý přístup k novinkám",
            "Možnost vlastního vývoje API napojení",
            "Vývoj modulů na zakázku"
        ],
        cta: {
            label: "Kontaktovat",
            href: "mailto:?subject=Enterprise%20Tender%20Flow",
            isMailto: true,
        },
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
                error: mapBillingErrorToUserMessage(normalizeErrorMessage(error, 'Platební brána není dostupná.')),
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
                error: mapBillingErrorToUserMessage(normalizeErrorMessage(error, 'Platební brána není dostupná.')),
            };
        }
    },

    createSetupIntent: async (): Promise<CreateSetupIntentResponse> => {
        try {
            return await invokeAuthedFunction<CreateSetupIntentResponse>(
                'stripe-create-setup-intent',
                { body: {} },
            );
        } catch (error) {
            return {
                success: false,
                error: mapBillingErrorToUserMessage(normalizeErrorMessage(error, 'Nepodařilo se zahájit peněženkovou platbu.')),
            };
        }
    },

    createSubscriptionFromPaymentMethod: async (
        request: CreateSubscriptionFromPaymentMethodRequest,
    ): Promise<CreateSubscriptionFromPaymentMethodResponse> => {
        try {
            return await invokeAuthedFunction<CreateSubscriptionFromPaymentMethodResponse>(
                'stripe-create-subscription-from-payment-method',
                {
                    body: {
                        tier: request.tier,
                        billingPeriod: request.billingPeriod ?? 'monthly',
                        paymentMethodId: request.paymentMethodId,
                        idempotencyKey: request.idempotencyKey,
                    },
                    idempotencyKey: request.idempotencyKey,
                },
            );
        } catch (error) {
            return {
                success: false,
                error: mapBillingErrorToUserMessage(normalizeErrorMessage(error, 'Nepodařilo se vytvořit předplatné.')),
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
    formatPrice: (
        priceOrTier: number | null | SubscriptionTier,
        billingCycle: 'monthly' | 'yearly' = 'monthly',
    ): string => {
        let priceInCents: number | null = null;
        if (priceOrTier === null) {
            priceInCents = null;
        } else if (typeof priceOrTier === 'number') {
            priceInCents = priceOrTier;
        } else if (priceOrTier === 'starter') {
            priceInCents = billingCycle === 'monthly'
                ? PRICING_CONFIG.starter.monthlyPrice
                : Math.round(PRICING_CONFIG.starter.yearlyPrice / 12);
        } else if (priceOrTier === 'pro') {
            priceInCents = billingCycle === 'monthly'
                ? PRICING_CONFIG.pro.monthlyPrice
                : Math.round(PRICING_CONFIG.pro.yearlyPrice / 12);
        } else if (priceOrTier === 'enterprise') {
            priceInCents = null;
        } else {
            priceInCents = 0;
        }

        if (priceInCents === null) return 'Na míru';
        return new Intl.NumberFormat('cs-CZ', {
            style: 'currency',
            currency: 'CZK',
            maximumFractionDigits: 0,
        }).format(priceInCents / 100);
    },
};
