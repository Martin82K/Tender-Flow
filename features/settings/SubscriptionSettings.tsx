import React, { useEffect, useState } from "react";
import { SubscriptionInfo, SubscriptionTier } from "../../types";
import { userSubscriptionService } from "../../services/userSubscriptionService";
import { billingService, PRICING_CONFIG } from "../../services/billingService";
import {
  getTierLabel,
  getTierBadgeClass,
  SUBSCRIPTION_TIERS,
} from "../../config/subscriptionTiers";
import {
  Check,
  AlertTriangle,
  Clock,
  CreditCard,
  Zap,
  Shield,
  RefreshCw,
} from "lucide-react";

interface SubscriptionSettingsProps {
  userId?: string;
}

export const SubscriptionSettings: React.FC<SubscriptionSettingsProps> = () => {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedPlans, setExpandedPlans] = useState({
    starter: false,
    pro: false,
    enterprise: false,
  });
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const init = async () => {
      // Check for success param from Stripe redirect
      const params = new URLSearchParams(window.location.search);
      if (params.get("success") === "true") {
        setMessage({
          type: "success",
          text: "Platba proběhla úspěšně. Aktualizujeme vaše předplatné...",
        });

        // Force sync with Stripe
        try {
          await billingService.syncSubscription();
        } catch (e) {
          console.error("Sync failed", e);
        }

        // Clean URL
        window.history.replaceState(
          {},
          "",
          window.location.pathname + "?tab=user&subTab=subscription",
        );
      }

      await loadSubscription();
    };
    init();
  }, []);

  const loadSubscription = async () => {
    setLoading(true);
    try {
      const status = await userSubscriptionService.getSubscriptionStatus();
      setSubscription(status);
    } catch (error) {
      console.error("Failed to load subscription:", error);
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
        setMessage({
          type: "success",
          text:
            result.message ||
            "Předplatné bude zrušeno na konci aktuálního období.",
        });
        setShowCancelConfirm(false);
        await loadSubscription();
      } else {
        setMessage({
          type: "error",
          text: result.error || "Nepodařilo se zrušit předplatné.",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "Došlo k chybě při rušení předplatného.",
      });
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
        setMessage({
          type: "success",
          text: result.message || "Předplatné bylo reaktivováno.",
        });
        await loadSubscription();
      } else {
        setMessage({
          type: "error",
          text: result.error || "Nepodařilo se reaktivovat předplatné.",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "Došlo k chybě při reaktivaci předplatného.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "monthly",
  );

  const handleUpgradeRequest = async (tier: SubscriptionTier) => {
    setActionLoading(true);
    setMessage(null);
    try {
      // First check if billing is configured
      if (billingService.isBillingConfigured()) {
        // Determine if we should use Checkout (new sub) or Portal (update sub)
        const hasActiveSubscription =
          subscription &&
          (subscription.status === "active" ||
            subscription.status === "trial") &&
          subscription.billingCustomerId;

        if (hasActiveSubscription) {
          // Update existing subscription via Billing Portal
          // This handles proration correctly
          const result = await billingService.createBillingPortalSession({
            returnUrl:
              window.location.origin +
              "/app/settings?tab=user&subTab=subscription",
          });
          if (result.success && result.portalUrl) {
            window.location.href = result.portalUrl;
            return;
          }
        } else {
          // Create new subscription via Checkout
          const result = await billingService.createCheckoutSession({
            tier: tier as "pro" | "enterprise",
            billingPeriod, // Pass selected billing period
            successUrl:
              window.location.origin +
              "/app/settings?tab=user&subTab=subscription&success=true",
            cancelUrl:
              window.location.origin +
              "/app/settings?tab=user&subTab=subscription",
          });
          if (result.success && result.checkoutUrl) {
            window.location.href = result.checkoutUrl;
            return;
          }
        }
      }

      // Fallback: request upgrade via RPC (admin approval flow)
      // Only if billing is NOT configured or failed
      const result = await userSubscriptionService.requestTierUpgrade(tier);
      if (result.success) {
        setMessage({
          type: "success",
          text: "Žádost o upgrade byla odeslána. Budeme vás kontaktovat s dalšími kroky.",
        });
      } else {
        setMessage({
          type: "error",
          text: result.message || "Nepodařilo se odeslat žádost.",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Došlo k chybě." });
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

  const isTrialing = subscription.status === "trial";
  const isCancelled =
    subscription.status === "cancelled" || subscription.cancelAtPeriodEnd;
  const isExpired = subscription.status === "expired";
  const isActive =
    subscription.status === "active" && !subscription.cancelAtPeriodEnd;

  const tierConfig =
    SUBSCRIPTION_TIERS[subscription.effectiveTier] || SUBSCRIPTION_TIERS.free;

  return (
    <section className="max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Předplatné
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Spravujte své předplatné a fakturační údaje
          </p>
        </div>

        {/* Status Refresh Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={loadSubscription}
            disabled={loading}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <Clock className="w-3.5 h-3.5" />
            Aktualizovat
          </button>
          {billingService.isBillingConfigured() && (
            <button
              onClick={async () => {
                setActionLoading(true);
                setMessage(null);
                try {
                  const result = await billingService.syncSubscription();
                  if (result.success) {
                    setMessage({
                      type: "success",
                      text: result.message || "Synchronizováno ze Stripe.",
                    });
                    await loadSubscription();
                  } else {
                    setMessage({
                      type: "error",
                      text: result.error || "Synchronizace selhala.",
                    });
                  }
                } catch (error) {
                  setMessage({
                    type: "error",
                    text: "Chyba při synchronizaci.",
                  });
                } finally {
                  setActionLoading(false);
                }
              }}
              disabled={actionLoading}
              className="text-[11px] font-bold text-orange-500 hover:text-orange-600 dark:hover:text-orange-400 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-orange-500/5 transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${actionLoading ? "animate-spin" : ""}`}
              />
              Sync Stripe
            </button>
          )}
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          className={`p-3.5 rounded-xl flex items-start gap-3 border ${
            message.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20"
              : "bg-red-50 dark:bg-red-500/5 text-red-700 dark:text-red-400 border-red-100 dark:border-red-500/20"
          }`}
        >
          {message.type === "success" ? (
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-xs font-semibold">{message.text}</p>
        </div>
      )}

      {/* Current Status & Upsell row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Current Subscription Card */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${tierConfig.badgeClass}`}
                >
                  {tierConfig.label}
                </span>
                {isTrialing && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-sky-500/10 text-sky-500 uppercase tracking-wider border border-sky-500/20">
                    Trial
                  </span>
                )}
                {isCancelled && !isExpired && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-500 uppercase tracking-wider border border-amber-500/20">
                    {subscription.expiresAt
                      ? `Končí ${userSubscriptionService.formatExpirationDate(subscription.expiresAt)}`
                      : "Zrušeno"}
                  </span>
                )}
                {isExpired && subscription.effectiveTier !== "free" && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-500/10 text-red-500 uppercase tracking-wider border border-red-500/20">
                    Vypršelo
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {getTierLabel(subscription.tier as any)}
                  {subscription.effectiveTier !== subscription.tier && (
                    <span className="ml-2 text-xs font-medium text-amber-500">
                      ({getTierLabel(subscription.effectiveTier as any)})
                    </span>
                  )}
                </p>
                {(subscription.daysRemaining !== null ||
                  isTrialing ||
                  isActive) &&
                  subscription.tier !== "free" && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Clock className="w-3 h-3" />
                      {isTrialing ? (
                        <span>
                          Končí za{" "}
                          <strong>{subscription.daysRemaining ?? 0} dní</strong>
                        </span>
                      ) : isCancelled && subscription.daysRemaining !== null ? (
                        <span>
                          Platné ještě{" "}
                          <strong>{subscription.daysRemaining} dní</strong>
                        </span>
                      ) : isActive && subscription.expiresAt ? (
                        <span>
                          Další fakturace{" "}
                          <strong>
                            {userSubscriptionService.formatExpirationDate(
                              subscription.expiresAt,
                            )}
                          </strong>
                        </span>
                      ) : subscription.daysRemaining !== null ? (
                        <span>
                          Platné{" "}
                          <strong>{subscription.daysRemaining} dní</strong>
                        </span>
                      ) : null}
                    </div>
                  )}
              </div>
            </div>

            {/* Auto-renewal Toggle */}
            {(isActive || (isCancelled && !isExpired)) &&
              subscription.tier !== "admin" &&
              subscription.tier !== "free" && (
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Automatické obnovení
                  </span>
                  <button
                    onClick={async () => {
                      setActionLoading(true);
                      setMessage(null);
                      try {
                        if (subscription.cancelAtPeriodEnd) {
                          // Currently cancelled (will expire at period end) -> Reactivate
                          const result =
                            await userSubscriptionService.reactivateSubscription();
                          if (result.success) {
                            setMessage({
                              type: "success",
                              text:
                                result.message ||
                                "Automatické obnovení zapnuto.",
                            });
                            await loadSubscription();
                          } else {
                            setMessage({
                              type: "error",
                              text:
                                result.error ||
                                "Nepodařilo se zapnout automatické obnovení.",
                            });
                          }
                        } else {
                          // Currently active -> Cancel (Turn off auto-renewal)
                          // We can skipp the confirm dialog for toggle interaction or keep it simple
                          const result =
                            await userSubscriptionService.cancelSubscription();
                          if (result.success) {
                            setMessage({
                              type: "success",
                              text:
                                result.message ||
                                "Automatické obnovení vypnuto. Předplatné skončí na konci období.",
                            });
                            await loadSubscription();
                          } else {
                            setMessage({
                              type: "error",
                              text:
                                result.error ||
                                "Nepodařilo se vypnout automatické obnovení.",
                            });
                          }
                        }
                      } catch (error) {
                        setMessage({
                          type: "error",
                          text: "Došlo k chybě při změně nastavení.",
                        });
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading}
                    className={`relative w-11 h-6 transition-colors duration-200 ease-in-out rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                      !subscription.cancelAtPeriodEnd
                        ? "bg-emerald-500"
                        : "bg-slate-300 dark:bg-slate-600"
                    }`}
                  >
                    <span
                      className={`inline-block w-5 h-5 transform bg-white rounded-full shadow transition-transform duration-200 ease-in-out mt-0.5 ml-0.5 ${
                        !subscription.cancelAtPeriodEnd
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              )}

            {/* Expired Renewal Action */}
            {isExpired && subscription.tier !== "free" && (
              <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/10 p-2 rounded-xl border border-red-100 dark:border-red-900/30">
                <span className="text-xs font-medium text-red-600 dark:text-red-400">
                  Předplatné vypršelo
                </span>
                <button
                  onClick={() =>
                    handleUpgradeRequest(subscription.tier as SubscriptionTier)
                  }
                  disabled={actionLoading}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-wide rounded-lg transition-all shadow-sm shadow-red-600/20"
                >
                  Obnovit
                </button>
              </div>
            )}

            {/* Quick Actions (only billing portal remaining) */}
            <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
              {billingService.isBillingConfigured() &&
                subscription.billingCustomerId && (
                  <button
                    onClick={async () => {
                      const result =
                        await billingService.createBillingPortalSession({
                          returnUrl:
                            window.location.origin +
                            "/app/settings?tab=user&subTab=subscription",
                        });
                      if (result.success && result.portalUrl) {
                        window.location.href = result.portalUrl;
                      }
                    }}
                    className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Správa karty
                  </button>
                )}
            </div>
          </div>
        </div>

        {/* Yearly Switch Upsell - show for active paid monthly subscriptions */}
        {isActive &&
          !isCancelled &&
          subscription.tier !== "free" &&
          subscription.tier !== "admin" &&
          billingService.isBillingConfigured() && (
            <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
              <div className="relative z-10">
                <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  Roční předplatné
                </h4>
                <p className="mt-1 text-xs text-emerald-800/70 dark:text-emerald-400/70">
                  Ušetřete 20% při platbě na rok.
                </p>
              </div>
              <button
                onClick={async () => {
                  setActionLoading(true);
                  try {
                    const result =
                      await billingService.createBillingPortalSession({
                        returnUrl:
                          window.location.origin +
                          "/app/settings?tab=user&subTab=subscription",
                      });
                    if (result.success && result.portalUrl) {
                      window.location.href = result.portalUrl;
                    }
                  } finally {
                    setActionLoading(false);
                  }
                }}
                disabled={actionLoading}
                className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-emerald-600/10"
              >
                Přejít na roční
              </button>
            </div>
          )}
      </div>

      {/* Manage Plan Section */}
      {subscription.effectiveTier !== "admin" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm relative z-0">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <Zap className="w-5 h-5 text-orange-500 fill-orange-500/20" />
              {subscription.tier === "free"
                ? "Vyberte si svůj plán"
                : "Změnit tarif"}
            </h3>

            {/* Monthly / Yearly Toggle */}
            <div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
              <button
                onClick={() => setBillingPeriod("monthly")}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  billingPeriod === "monthly"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Měsíčně
              </button>
              <button
                onClick={() => setBillingPeriod("yearly")}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  billingPeriod === "yearly"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Ročně
                <span className="text-[9px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-black">
                  -20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-6">
            {/* Free Plan */}
            <div
              className={`border rounded-2xl p-6 transition-all flex flex-col relative ${
                subscription.effectiveTier === "free"
                  ? "border-slate-400 bg-slate-400/5 ring-1 ring-slate-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 shadow-lg"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-slate-500 dark:text-slate-400 font-mono uppercase tracking-widest">
                  Free
                </span>
                {subscription.effectiveTier === "free" && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-lg ring-2 ring-white dark:ring-slate-900 whitespace-nowrap">
                    AKTIVNÍ
                  </span>
                )}
              </div>
              <div className="mb-5">
                <p className="text-3xl font-black text-slate-900 dark:text-white">
                  Zdarma
                </p>
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  Základní funkce
                </li>
                <li className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />1 aktivní
                  projekt
                </li>
              </ul>
              {subscription.effectiveTier !== "free" && (
                <button
                  onClick={async () => {
                    setActionLoading(true);
                    try {
                      const result =
                        await billingService.createBillingPortalSession({
                          returnUrl:
                            window.location.origin +
                            "/app/settings?tab=user&subTab=subscription",
                        });
                      if (result.success && result.portalUrl) {
                        window.location.href = result.portalUrl;
                      }
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                  className="w-full py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  Downgrade
                </button>
              )}
            </div>

            {/* Starter Plan */}
            <div
              className={`border rounded-2xl p-6 transition-all flex flex-col relative ${
                subscription.effectiveTier === "starter"
                  ? "border-sky-500 bg-sky-500/5 ring-1 ring-sky-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 shadow-lg"
                  : "border-sky-100 dark:border-sky-900/30 bg-white dark:bg-slate-900 hover:border-sky-200 dark:hover:border-sky-800 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-sky-500 fill-current" />
                  <span className="text-xs font-black text-sky-600 dark:text-sky-400 font-mono uppercase tracking-widest">
                    Starter
                  </span>
                </div>
                {subscription.effectiveTier === "starter" && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sky-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-lg ring-2 ring-white dark:ring-slate-900 whitespace-nowrap">
                    AKTIVNÍ
                  </span>
                )}
              </div>
              <div className="mb-5">
                {billingPeriod === "yearly" && (
                  <p className="text-sm font-medium text-slate-400 line-through mb-0.5">
                    {billingService.formatPrice(
                      PRICING_CONFIG.starter.monthlyPrice,
                    )}
                  </p>
                )}
                <p className="text-3xl font-black text-slate-900 dark:text-white">
                  {billingPeriod === "monthly"
                    ? billingService.formatPrice(
                        PRICING_CONFIG.starter.monthlyPrice,
                      )
                    : billingService.formatPrice(
                        Math.round(PRICING_CONFIG.starter.yearlyPrice / 12),
                      )}
                  <span className="text-xs font-medium text-slate-400 ml-1">
                    /m
                  </span>
                </p>
              </div>
              <div className="mb-6 flex-1 flex flex-col">
                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  {(expandedPlans.starter
                    ? PRICING_CONFIG.starter.features
                    : PRICING_CONFIG.starter.features.slice(0, 5)
                  ).map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-sky-500 mt-0.5" />
                      <span className="leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-3 h-6 flex items-center">
                  {PRICING_CONFIG.starter.features.length > 5 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPlans((prev) => ({
                          ...prev,
                          starter: !prev.starter,
                        }))
                      }
                      className="text-[10px] font-bold uppercase tracking-wider text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition-colors"
                    >
                      {expandedPlans.starter ? "Zobrazit méně" : "Zobrazit více"}
                    </button>
                  )}
                </div>
              </div>
              {subscription.effectiveTier !== "starter" && (
                <button
                  onClick={() => handleUpgradeRequest("starter")}
                  disabled={actionLoading}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                    subscription.effectiveTier === "free"
                      ? "bg-sky-500 hover:bg-sky-600 text-white shadow-sm shadow-sky-500/20"
                      : "border border-sky-400 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10"
                  }`}
                >
                  {subscription.effectiveTier === "free"
                    ? "Vybrat Starter"
                    : "Downgrade"}
                </button>
              )}
            </div>

            {/* Pro Plan */}
            <div
              className={`border rounded-2xl p-6 transition-all flex flex-col relative ${
                subscription.effectiveTier === "pro"
                  ? "border-orange-500 bg-orange-500/5 ring-1 ring-orange-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 shadow-lg"
                  : "border-orange-100 dark:border-orange-900/30 bg-white dark:bg-slate-900 hover:border-orange-200 dark:hover:border-orange-800 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-orange-500 fill-current" />
                  <span className="text-xs font-black text-orange-600 dark:text-orange-400 font-mono uppercase tracking-widest">
                    PRO
                  </span>
                </div>
                {subscription.effectiveTier === "pro" && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-lg ring-2 ring-white dark:ring-slate-900 whitespace-nowrap">
                    AKTIVNÍ
                  </span>
                )}
              </div>
              <div className="mb-5">
                {billingPeriod === "yearly" && (
                  <p className="text-sm font-medium text-slate-400 line-through mb-0.5">
                    {billingService.formatPrice(
                      PRICING_CONFIG.pro.monthlyPrice,
                    )}
                  </p>
                )}
                <p className="text-3xl font-black text-slate-900 dark:text-white">
                  {billingPeriod === "monthly"
                    ? billingService.formatPrice(
                        PRICING_CONFIG.pro.monthlyPrice,
                      )
                    : billingService.formatPrice(
                        Math.round(PRICING_CONFIG.pro.yearlyPrice / 12),
                      )}
                  <span className="text-xs font-medium text-slate-400 ml-1">
                    /m
                  </span>
                </p>
              </div>
              <div className="mb-6 flex-1 flex flex-col">
                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  {(expandedPlans.pro
                    ? PRICING_CONFIG.pro.features
                    : PRICING_CONFIG.pro.features.slice(0, 5)
                  ).map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-orange-500 mt-0.5" />
                      <span className="leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-3 h-6 flex items-center">
                  {PRICING_CONFIG.pro.features.length > 5 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPlans((prev) => ({
                          ...prev,
                          pro: !prev.pro,
                        }))
                      }
                      className="text-[10px] font-bold uppercase tracking-wider text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
                    >
                      {expandedPlans.pro ? "Zobrazit méně" : "Zobrazit více"}
                    </button>
                  )}
                </div>
              </div>
              {subscription.effectiveTier !== "pro" && (
                <button
                  onClick={() => handleUpgradeRequest("pro")}
                  disabled={actionLoading}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                    subscription.effectiveTier === "free" ||
                    subscription.effectiveTier === "starter"
                      ? "bg-orange-500 hover:bg-orange-600 text-white shadow-sm shadow-orange-500/20"
                      : "border border-orange-400 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
                  }`}
                >
                  {subscription.effectiveTier === "free" ||
                  subscription.effectiveTier === "starter"
                    ? "Vybrat Pro"
                    : "Downgrade"}
                </button>
              )}
            </div>

            {/* Enterprise Plan */}
            <div
              className={`border rounded-2xl p-6 transition-all flex flex-col relative ${
                subscription.effectiveTier === "enterprise"
                  ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 shadow-lg"
                  : "border-emerald-100 dark:border-emerald-900/30 bg-white dark:bg-slate-900 hover:border-emerald-200 dark:hover:border-emerald-800 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-600 fill-current" />
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono uppercase tracking-widest">
                    ENTERPRISE
                  </span>
                </div>
                {subscription.effectiveTier === "enterprise" && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-lg ring-2 ring-white dark:ring-slate-900 whitespace-nowrap">
                    AKTIVNÍ
                  </span>
                )}
              </div>
              <div className="mb-5">
                <p className="text-3xl font-black text-slate-900 dark:text-white">
                  Na míru
                </p>
              </div>
              <div className="mb-6 flex-1 flex flex-col">
                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  {(expandedPlans.enterprise
                    ? PRICING_CONFIG.enterprise.features
                    : PRICING_CONFIG.enterprise.features.slice(0, 5)
                  ).map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5" />
                      <span className="leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-3 h-6 flex items-center">
                  {PRICING_CONFIG.enterprise.features.length > 5 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPlans((prev) => ({
                          ...prev,
                          enterprise: !prev.enterprise,
                        }))
                      }
                      className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                    >
                      {expandedPlans.enterprise
                        ? "Zobrazit méně"
                        : "Zobrazit více"}
                    </button>
                  )}
                </div>
              </div>
              {subscription.effectiveTier !== "enterprise" && (
                <button
                  onClick={() => handleUpgradeRequest("enterprise")}
                  disabled={actionLoading}
                  className="w-full py-2 border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  Kontaktovat
                </button>
              )}
            </div>
          </div>

          <p className="mt-5 text-[10px] text-slate-400 dark:text-slate-500 text-center">
            Bezpečné platby přes Stripe. Nevyužité období je automaticky
            přepočítáno.
          </p>
        </div>
      )}
    </section>
  );
};
