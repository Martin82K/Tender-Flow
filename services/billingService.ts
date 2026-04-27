/**
 * Billing Service — user-level předplatné.
 *
 * Routuje volání přes `paymentProviderService` (provider-aware: gopay | stripe).
 * Tenhle modul drží jen UI-friendly error mapping a pricing config.
 */

import { paymentProviderService } from './paymentProviderService';
import type { SubscriptionTier } from '@/types';

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
    paymentUrl?: string;
    paymentId?: string;
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
        normalized.includes('not configured') ||
        normalized.includes('gopay_goid') ||
        normalized.includes('gopay_client') ||
        normalized.includes('stripe_secret_key') ||
        normalized.includes('stripe_price_') ||
        normalized.includes('stripe_webhook_secret')
    ) {
        return 'Platební brána není správně nakonfigurovaná. Kontaktujte prosím podporu.';
    }

    if (normalized.includes('redirect url is not allowed')) {
        return 'Neplatná návratová URL platby. Obnovte stránku a zkuste to znovu.';
    }

    if (normalized.includes('unauthorized') || normalized.includes('nejste přihlášen')) {
        return 'Vaše relace vypršela. Přihlaste se znovu a opakujte akci.';
    }

    if (normalized.includes('oauth') || normalized.includes('token') || normalized.includes('invalid api key')) {
        return 'Chyba autentizace platební brány. Zkuste to prosím znovu.';
    }

    if (
        normalized.includes('no active subscription') ||
        normalized.includes('no stripe subscription found')
    ) {
        return 'Nebylo nalezeno aktivní předplatné.';
    }

    return rawError || 'Platební brána není dostupná.';
};

// Pricing configuration
export const PRICING_CONFIG = {
    starter: {
        title: "Starter",
        monthlyPrice: 39900, // In hellers (CZK) = 399 Kč
        yearlyPrice: 383040, // 3830 Kč (20% discount)
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
        monthlyPrice: 49900, // In hellers (CZK) = 499 Kč
        yearlyPrice: 479000, // 4790 Kč (20% discount)
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
            "Geokódování kontaktů",
            "Integrace mapy s kontakty"
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
     * Create a checkout session for subscription purchase via active provider.
     * Returns a payment URL to redirect the user to provider's hosted checkout.
     */
    createCheckoutSession: async (
        request: CheckoutSessionRequest
    ): Promise<CheckoutSessionResponse> => {
        try {
            const result = await paymentProviderService.createUserCheckoutSession({
                tier: request.tier,
                billingPeriod: request.billingPeriod,
                successUrl: request.successUrl,
                cancelUrl: request.cancelUrl,
            });

            return {
                success: result.success,
                checkoutUrl: result.checkoutUrl ?? result.paymentUrl,
                paymentUrl: result.paymentUrl,
                paymentId: result.paymentId,
                error: result.error ? mapBillingErrorToUserMessage(result.error) : undefined,
            };
        } catch (error) {
            return {
                success: false,
                error: mapBillingErrorToUserMessage(normalizeErrorMessage(error, 'Platební brána není dostupná.')),
            };
        }
    },

    /**
     * Cancel recurring payments via active provider.
     * Subscription remains active until the current period ends.
     */
    cancelRecurrence: async (): Promise<{
        success: boolean;
        message?: string;
        error?: string;
    }> => {
        try {
            return await paymentProviderService.cancelUserSubscription();
        } catch (error) {
            return {
                success: false,
                error: mapBillingErrorToUserMessage(normalizeErrorMessage(error, 'Nepodařilo se zrušit opakovanou platbu.')),
            };
        }
    },

    /**
     * Force sync subscription data from active provider.
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
            return await paymentProviderService.syncUserSubscription();
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Synchronizace selhala.',
            };
        }
    },

    /**
     * Check if billing is properly configured.
     */
    isBillingConfigured: (): boolean => {
        return Boolean(
            import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
        );
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
