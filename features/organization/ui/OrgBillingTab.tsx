/**
 * OrgBillingTab
 *
 * Organization billing management — plan selection with plan cards,
 * monthly/yearly toggle, billing history, and checkout flow.
 */

import React, { useEffect, useState } from 'react';
import { getOrgSubscription, getOrgBillingHistory, getOrgSeatUsage, updateOrgSeats } from '../api/orgBillingService';
import { createOrgCheckout, cancelOrgSubscription, syncOrgSubscription, formatOrgPrice } from '../api/orgBillingActions';
import { PRICING_CONFIG } from '@/services/billingService';
import { getTierLabel, getTierBadgeClass } from '@/config/subscriptionTiers';
import { isRedirectUrlSafe } from '@shared/security/validateRedirectUrl';
import type { OrgSubscriptionInfo, OrgBillingHistoryEntry, OrgSeatUsage } from '../model/types';

interface OrgBillingTabProps {
  orgId: string;
  isOwner: boolean;
}

const BILLING_RETURN_FALLBACK_ORIGIN = 'https://tenderflow.cz';

const getBillingReturnUrl = (path: string): string => {
  if (typeof window === 'undefined' || window.location.protocol === 'file:') {
    return new URL(path, BILLING_RETURN_FALLBACK_ORIGIN).toString();
  }
  return new URL(path, window.location.origin).toString();
};

type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise';

const PLAN_DEFS: { tier: PlanTier; label: string; accent: string; perSeatLabel: string; features: string[]; highlighted: string[] }[] = [
  {
    tier: 'free',
    label: 'Free',
    accent: 'slate',
    perSeatLabel: '1 uživatel, 1 projekt',
    features: ['Dashboard', 'Základní projekty', 'Kontakty', 'URL Shortener'],
    highlighted: [],
  },
  {
    tier: 'starter',
    label: 'Starter',
    accent: 'sky',
    perSeatLabel: 'až 10 seats',
    features: ['Neomezené projekty', 'Subdodavatelé', 'Export Excel & PDF', 'Excel Unlocker', 'Základní přehled'],
    highlighted: [],
  },
  {
    tier: 'pro',
    label: 'Pro',
    accent: 'indigo',
    perSeatLabel: 'až 25 seats',
    features: ['Vše ze Starter'],
    highlighted: ['Desktop aplikace', 'Složkomat (auto složky)', 'Plán výběrových řízení', 'Importy VŘ', 'Pokročilé exporty'],
  },
  {
    tier: 'enterprise',
    label: 'Enterprise',
    accent: 'emerald',
    perSeatLabel: 'neomezené seats',
    features: ['Vše z Pro'],
    highlighted: ['OCR dokumenty', 'Hodnocení dodavatelů', 'Pokročilé integrace', 'Geokódování & mapy', 'Detailní reporty'],
  },
];

export const OrgBillingTab: React.FC<OrgBillingTabProps> = ({ orgId, isOwner }) => {
  const [subscription, setSubscription] = useState<OrgSubscriptionInfo | null>(null);
  const [seatUsage, setSeatUsage] = useState<OrgSeatUsage | null>(null);
  const [history, setHistory] = useState<OrgBillingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingSeats, setEditingSeats] = useState(false);
  const [newSeatCount, setNewSeatCount] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sub, seats, hist] = await Promise.all([
        getOrgSubscription(orgId),
        getOrgSeatUsage(orgId),
        getOrgBillingHistory(orgId),
      ]);
      setSubscription(sub);
      setSeatUsage(seats);
      setHistory(hist);
    } catch (err) {
      console.error('[OrgBillingTab] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check for payment redirect params
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setMessage({ type: 'success', text: 'Platba proběhla úspěšně. Aktualizujeme vaše předplatné...' });
      syncOrgSubscription(orgId).catch(() => {});
      window.history.replaceState({}, '', window.location.pathname + '?tab=organization&subTab=billing');
    }
    if (params.get('cancelled') === 'true') {
      setMessage({ type: 'error', text: 'Platba byla zrušena. Předplatné zůstalo beze změny.' });
      window.history.replaceState({}, '', window.location.pathname + '?tab=organization&subTab=billing');
    }
    loadData();
  }, [orgId]);

  const handleUpgrade = async (tier: 'starter' | 'pro' | 'enterprise') => {
    if (!isOwner) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const seats = seatUsage?.billableSeats || 1;
      const result = await createOrgCheckout({
        orgId,
        tier,
        billingPeriod,
        seats,
        successPath: getBillingReturnUrl('/app/settings?tab=organization&subTab=billing&success=true'),
        cancelPath: getBillingReturnUrl('/app/settings?tab=organization&subTab=billing&cancelled=true'),
      });
      if (result.success && result.checkoutUrl) {
        if (!isRedirectUrlSafe(result.checkoutUrl)) {
          setMessage({ type: 'error', text: 'Neplatná platební URL.' });
          return;
        }
        window.location.href = result.checkoutUrl;
        return;
      }
      setMessage({ type: 'error', text: result.error || 'Nepodařilo se zahájit platbu.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Došlo k chybě.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const result = await cancelOrgSubscription(orgId);
      if (result.success) {
        setMessage({ type: 'success', text: 'Předplatné bude zrušeno na konci aktuálního období.' });
        await loadData();
      } else {
        setMessage({ type: 'error', text: result.error || 'Nepodařilo se zrušit předplatné.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Chyba při rušení.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSync = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const result = await syncOrgSubscription(orgId);
      if (result.success) {
        setMessage({ type: 'success', text: 'Synchronizováno.' });
        await loadData();
      } else {
        setMessage({ type: 'error', text: result.error || 'Synchronizace selhala.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Chyba při synchronizaci.' });
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

  const currentTier = subscription?.overrideTier || subscription?.tier || 'free';
  const isOverridden = !!subscription?.overrideTier;

  const getPriceDisplay = (tier: PlanTier): string => {
    if (tier === 'free') return 'Zdarma';
    if (tier === 'enterprise') return 'Na míru';
    const config = PRICING_CONFIG[tier as 'starter' | 'pro'];
    if (!config) return '—';
    const price = billingPeriod === 'yearly'
      ? Math.round((config.yearlyPrice || 0) / 1200)
      : Math.round((config.monthlyPrice || 0) / 100);
    return `${price}`;
  };

  return (
    <section className="space-y-6">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
        Předplatné & Fakturace
      </h3>

      {/* Message */}
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {message.text}
        </div>
      )}

      {/* Current Plan Summary */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/0 border border-primary/20 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0 ${
          currentTier === 'enterprise'
            ? 'bg-gradient-to-br from-emerald-500 to-emerald-700'
            : 'bg-gradient-to-br from-primary to-primary/80'
        }`}>
          <span className="material-symbols-outlined text-[24px]">
            {currentTier === 'enterprise' ? 'diamond' : 'bolt'}
          </span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              {getTierLabel(currentTier as any)}
            </span>
            {isOverridden && (
              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded">
                ZVÝHODNĚNO
              </span>
            )}
            {seatUsage && (
              <span className="text-sm text-slate-500">· {seatUsage.billableSeats} seats</span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {subscription?.expiresAt && (
              <>Příští platba: {new Date(subscription.expiresAt).toLocaleDateString('cs-CZ')}</>
            )}
          </p>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={actionLoading || currentTier === 'free'}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Zrušit předplatné
            </button>
            <button
              onClick={handleSync}
              disabled={actionLoading}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Synchronizovat
            </button>
          </div>
        )}
      </div>

      {/* Seat Management */}
      {isOwner && seatUsage && currentTier !== 'free' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-slate-400">group</span>
            Správa licencí (seats)
          </h4>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="text-sm text-slate-500">
                  Obsazeno <strong className="text-slate-700 dark:text-slate-200">{seatUsage.billableSeats}</strong> z <strong className="text-slate-700 dark:text-slate-200">{seatUsage.maxSeats}</strong> míst
                </div>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden max-w-md">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((seatUsage.billableSeats / seatUsage.maxSeats) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {editingSeats ? (
                <>
                  <button
                    onClick={() => setNewSeatCount(prev => Math.max(seatUsage.billableSeats, prev - 1))}
                    disabled={newSeatCount <= seatUsage.billableSeats}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined text-[18px]">remove</span>
                  </button>
                  <span className="w-12 text-center text-lg font-bold text-slate-900 dark:text-white">
                    {newSeatCount}
                  </span>
                  <button
                    onClick={() => setNewSeatCount(prev => prev + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </button>
                  <button
                    onClick={async () => {
                      if (newSeatCount === seatUsage.maxSeats) {
                        setEditingSeats(false);
                        return;
                      }
                      setActionLoading(true);
                      setMessage(null);
                      try {
                        await updateOrgSeats(orgId, newSeatCount);
                        setMessage({ type: 'success', text: `Počet licencí změněn na ${newSeatCount}.` });
                        setEditingSeats(false);
                        await loadData();
                      } catch (err: any) {
                        setMessage({ type: 'error', text: err?.message || 'Nepodařilo se změnit počet licencí.' });
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading || newSeatCount === seatUsage.maxSeats}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-primary hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    Uložit
                  </button>
                  <button
                    onClick={() => setEditingSeats(false)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    Zrušit
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setNewSeatCount(seatUsage.maxSeats);
                    setEditingSeats(true);
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-primary/30 text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Upravit počet licencí
                </button>
              )}
            </div>
          </div>
          {editingSeats && newSeatCount !== seatUsage.maxSeats && (
            <p className="text-xs text-slate-400 mt-3">
              Změna počtu licencí se projeví od dalšího fakturačního období.
            </p>
          )}
        </div>
      )}

      {/* Plan Selection */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-base font-bold text-slate-700 dark:text-slate-300">
            Změna plánu
          </h4>
          <div className="flex items-center gap-3">
            <span className={`text-sm ${billingPeriod === 'monthly' ? 'font-bold text-slate-700 dark:text-slate-300' : 'text-slate-500'}`}>
              Měsíčně
            </span>
            <button
              onClick={() => setBillingPeriod(p => p === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative w-12 h-6 rounded-full border transition-colors ${
                billingPeriod === 'yearly'
                  ? 'bg-primary border-primary'
                  : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
              }`}
            >
              <div className={`absolute w-5 h-5 rounded-full bg-white shadow top-0.5 transition-transform ${
                billingPeriod === 'yearly' ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
            <span className={`text-sm ${billingPeriod === 'yearly' ? 'font-bold text-slate-700 dark:text-slate-300' : 'text-slate-500'}`}>
              Ročně
            </span>
            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold rounded">
              -20%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLAN_DEFS.map(plan => {
            const isCurrent = currentTier === plan.tier;
            const isRecommended = plan.tier === 'pro' && currentTier !== 'pro' && currentTier !== 'enterprise';
            const price = getPriceDisplay(plan.tier);

            return (
              <div
                key={plan.tier}
                className={`relative bg-white dark:bg-slate-800 border rounded-xl p-5 flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  isCurrent
                    ? 'border-primary shadow-sm ring-1 ring-primary'
                    : isRecommended
                    ? 'border-indigo-400 dark:border-indigo-600'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full">
                    AKTIVNÍ
                  </div>
                )}
                {isRecommended && !isCurrent && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-indigo-500 text-white text-[10px] font-bold rounded-full">
                    DOPORUČENO
                  </div>
                )}

                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {plan.label}
                </div>

                <div className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1">
                  {price}
                  {plan.tier !== 'free' && plan.tier !== 'enterprise' && (
                    <>
                      <span className="text-base font-semibold ml-1">Kč</span>
                      <span className="text-sm font-normal text-slate-400">/seat/m</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-slate-400 mb-4">{plan.perSeatLabel}</div>

                <ul className="space-y-1.5 mb-5 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="text-xs text-slate-500 flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5">&#10003;</span>
                      {f}
                    </li>
                  ))}
                  {plan.highlighted.map(f => (
                    <li key={f} className="text-xs text-slate-500 flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">&#9733;</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-2.5 text-sm font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                  >
                    Současný plán
                  </button>
                ) : plan.tier === 'free' ? (
                  <button
                    disabled={actionLoading || !isOwner}
                    className="w-full py-2.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    Downgrade
                  </button>
                ) : plan.tier === 'enterprise' ? (
                  <a
                    href="mailto:info@tenderflow.cz?subject=Enterprise%20Tender%20Flow"
                    className="block w-full py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-center hover:opacity-90 transition-opacity"
                  >
                    Kontaktovat
                  </a>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.tier as 'starter' | 'pro')}
                    disabled={actionLoading || !isOwner}
                    className="w-full py-2.5 text-sm font-semibold rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50 bg-gradient-to-r from-primary to-primary/90"
                  >
                    Upgradovat
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing History */}
      {history.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-slate-400">receipt_long</span>
            Historie plateb
          </h4>
          <div className="space-y-2">
            {history.map(entry => (
              <div key={entry.id} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700/30 last:border-0">
                <span className="text-sm text-slate-500">
                  {new Date(entry.createdAt).toLocaleDateString('cs-CZ')}
                  {entry.tier && ` — ${getTierLabel(entry.tier as any)}`}
                  {entry.seatsCount && ` (${entry.seatsCount} seats)`}
                </span>
                <span className={`text-sm font-medium ${
                  entry.status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'
                }`}>
                  {formatOrgPrice(entry.amount)}
                  {entry.status === 'paid' && ' ✓'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
