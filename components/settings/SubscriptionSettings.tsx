import React, { useEffect, useState } from 'react';
import { SubscriptionInfo, SubscriptionTier } from '../../types';
import { userSubscriptionService } from '../../services/userSubscriptionService';
import { billingService, PRICING_CONFIG } from '../../services/billingService';
import { getTierLabel, getTierBadgeClass, SUBSCRIPTION_TIERS } from '../../config/subscriptionTiers';
import { Check, AlertTriangle, Clock, CreditCard, Zap, Shield } from 'lucide-react';

interface SubscriptionSettingsProps {
    userId?: string;
}

export const SubscriptionSettings: React.FC<SubscriptionSettingsProps> = () => {
    const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadSubscription();
    }, []);

    const loadSubscription = async () => {
        setLoading(true);
        try {
            const status = await userSubscriptionService.getSubscriptionStatus();
            setSubscription(status);
        } catch (error) {
            console.error('Failed to load subscription:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        setActionLoading(true);
        setMessage(null);
        try {
            const result = await userSubscriptionService.cancelSubscription();
            if (result.success) {
                setMessage({ type: 'success', text: result.message || 'Předplatné bude zrušeno na konci aktuálního období.' });
                setShowCancelConfirm(false);
                await loadSubscription();
            } else {
                setMessage({ type: 'error', text: result.error || 'Nepodařilo se zrušit předplatné.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Došlo k chybě při rušení předplatného.' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleReactivate = async () => {
        setActionLoading(true);
        setMessage(null);
        try {
            const result = await userSubscriptionService.reactivateSubscription();
            if (result.success) {
                setMessage({ type: 'success', text: result.message || 'Předplatné bylo reaktivováno.' });
                await loadSubscription();
            } else {
                setMessage({ type: 'error', text: result.error || 'Nepodařilo se reaktivovat předplatné.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Došlo k chybě při reaktivaci předplatného.' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpgradeRequest = async (tier: SubscriptionTier) => {
        setActionLoading(true);
        setMessage(null);
        try {
            // First check if billing is configured
            if (billingService.isBillingConfigured()) {
                // Would redirect to Stripe Checkout
                const result = await billingService.createCheckoutSession({
                    tier: tier as 'pro' | 'enterprise',
                    successUrl: window.location.origin + '/app/settings?tab=user&subTab=subscription&success=true',
                    cancelUrl: window.location.origin + '/app/settings?tab=user&subTab=subscription',
                });
                if (result.success && result.checkoutUrl) {
                    window.location.href = result.checkoutUrl;
                    return;
                }
            }

            // Fallback: request upgrade via RPC (admin approval flow)
            const result = await userSubscriptionService.requestTierUpgrade(tier);
            if (result.success) {
                setMessage({
                    type: 'success',
                    text: 'Žádost o upgrade byla odeslána. Budeme vás kontaktovat s dalšími kroky.',
                });
            } else {
                setMessage({ type: 'error', text: result.message || 'Nepodařilo se odeslat žádost.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Došlo k chybě.' });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-slate-300 border-t-primary rounded-full" />
            </div>
        );
    }

    if (!subscription) {
        return (
            <div className="text-center py-12 text-slate-500">
                Nepodařilo se načíst informace o předplatném.
            </div>
        );
    }

    const isTrialing = subscription.status === 'trial';
    const isCancelled = subscription.status === 'cancelled' || subscription.cancelAtPeriodEnd;
    const isExpired = subscription.status === 'expired';
    const isActive = subscription.status === 'active' && !subscription.cancelAtPeriodEnd;

    const tierConfig = SUBSCRIPTION_TIERS[subscription.effectiveTier] || SUBSCRIPTION_TIERS.free;

    return (
        <section className="space-y-6">
            {/* Header */}
            <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-orange-500" />
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        Předplatné
                    </h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                    Spravujte své předplatné a fakturační údaje
                </p>
            </div>

            {/* Message Banner */}
            {message && (
                <div
                    className={`p-4 rounded-xl flex items-start gap-3 ${message.type === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                        }`}
                >
                    {message.type === 'success' ? (
                        <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    ) : (
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm font-medium">{message.text}</p>
                </div>
            )}

            {/* Current Subscription Card */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <span
                                className={`px-3 py-1 rounded-full text-sm font-semibold border ${tierConfig.badgeClass}`}
                            >
                                {tierConfig.label}
                            </span>
                            {isTrialing && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400">
                                    Zkušební období
                                </span>
                            )}
                            {isCancelled && !isExpired && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                                    Zrušeno k {userSubscriptionService.formatExpirationDate(subscription.expiresAt)}
                                </span>
                            )}
                            {isExpired && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">
                                    Vypršelo
                                </span>
                            )}
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                            Aktuální plán: <strong>{getTierLabel(subscription.tier as any)}</strong>
                            {subscription.effectiveTier !== subscription.tier && (
                                <span className="text-amber-600 dark:text-amber-400">
                                    {' '}(efektivní: {getTierLabel(subscription.effectiveTier as any)})
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Expiration/Trial Info */}
                    {(subscription.daysRemaining !== null || isTrialing) && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700/50">
                            <Clock className="w-4 h-4 text-slate-500" />
                            <div className="text-sm">
                                {isTrialing ? (
                                    <span>
                                        Zkušební období končí za{' '}
                                        <strong className="text-slate-900 dark:text-white">
                                            {subscription.daysRemaining} dní
                                        </strong>
                                    </span>
                                ) : subscription.daysRemaining !== null ? (
                                    <span>
                                        {isCancelled ? 'Aktivní ještě' : 'Platné ještě'}{' '}
                                        <strong className="text-slate-900 dark:text-white">
                                            {subscription.daysRemaining} dní
                                        </strong>
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap gap-3">
                    {isCancelled && !isExpired && (
                        <button
                            onClick={handleReactivate}
                            disabled={actionLoading}
                            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50"
                        >
                            {actionLoading ? 'Zpracovávám...' : 'Reaktivovat předplatné'}
                        </button>
                    )}

                    {isActive && subscription.tier !== 'admin' && (
                        <button
                            onClick={() => setShowCancelConfirm(true)}
                            disabled={actionLoading}
                            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 font-medium transition-colors disabled:opacity-50"
                        >
                            Zrušit předplatné
                        </button>
                    )}

                    {billingService.isBillingConfigured() && subscription.billingCustomerId && (
                        <button
                            onClick={async () => {
                                const result = await billingService.createBillingPortalSession();
                                if (result.success && result.portalUrl) {
                                    window.location.href = result.portalUrl;
                                }
                            }}
                            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 font-medium transition-colors"
                        >
                            Správa plateb
                        </button>
                    )}
                </div>
            </div>

            {/* Cancel Confirmation Modal */}
            {showCancelConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-xl">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                            Opravdu chcete zrušit předplatné?
                        </h3>
                        <p className="text-sm text-slate-500 mb-6">
                            Vaše předplatné zůstane aktivní do konce aktuálního fakturačního období
                            ({userSubscriptionService.formatExpirationDate(subscription.expiresAt)}).
                            Po tomto datu budete převedeni na bezplatný plán.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowCancelConfirm(false)}
                                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 font-medium transition-colors"
                            >
                                Zpět
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={actionLoading}
                                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors disabled:opacity-50"
                            >
                                {actionLoading ? 'Ruším...' : 'Ano, zrušit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upgrade Options (show if not on highest tier) */}
            {subscription.effectiveTier !== 'admin' && subscription.effectiveTier !== 'enterprise' && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-orange-500" />
                        Upgradovat plán
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Pro Plan */}
                        {subscription.effectiveTier === 'free' && (
                            <div className="border border-orange-200 dark:border-orange-500/30 rounded-xl p-5 bg-gradient-to-br from-orange-50 to-transparent dark:from-orange-500/5">
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap className="w-5 h-5 text-orange-500" />
                                    <span className="font-bold text-slate-900 dark:text-white">Pro</span>
                                </div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                                    {billingService.formatPrice(PRICING_CONFIG.pro.monthlyPrice)}
                                    <span className="text-sm font-normal text-slate-500">/měsíc</span>
                                </p>
                                <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-emerald-500" />
                                        Neomezené projekty
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-emerald-500" />
                                        AI reporty & analýzy
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-emerald-500" />
                                        Excel nástroje PRO
                                    </li>
                                </ul>
                                <button
                                    onClick={() => handleUpgradeRequest('pro')}
                                    disabled={actionLoading}
                                    className="mt-4 w-full px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors disabled:opacity-50"
                                >
                                    {actionLoading ? 'Zpracovávám...' : 'Upgradovat na Pro'}
                                </button>
                            </div>
                        )}

                        {/* Enterprise Plan */}
                        <div className="border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-5 bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-500/5">
                            <div className="flex items-center gap-2 mb-2">
                                <Shield className="w-5 h-5 text-emerald-600" />
                                <span className="font-bold text-slate-900 dark:text-white">Enterprise</span>
                            </div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                                Na míru
                            </p>
                            <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                <li className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-500" />
                                    Vše z Pro
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-500" />
                                    On-premise nasazení
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-500" />
                                    Prioritní podpora
                                </li>
                            </ul>
                            <button
                                onClick={() => handleUpgradeRequest('enterprise')}
                                disabled={actionLoading}
                                className="mt-4 w-full px-4 py-2 rounded-lg border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 font-medium transition-colors disabled:opacity-50"
                            >
                                {actionLoading ? 'Zpracovávám...' : 'Kontaktovat'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};
