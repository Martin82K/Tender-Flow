/**
 * OrgBillingTab
 *
 * Organization-level Enterprise billing overview. Self-service Starter/Pro
 * checkout is intentionally paused while Tender Flow is sold sales-assisted.
 */

import React, { useEffect, useState } from 'react';
import { getOrgSubscription, getOrgBillingHistory, getOrgSeatUsage } from '../api/orgBillingService';
import { formatOrgPrice } from '../api/orgBillingActions';
import { getTierLabel } from '@/config/subscriptionTiers';
import type { OrgSubscriptionInfo, OrgBillingHistoryEntry, OrgSeatUsage } from '../model/types';

interface OrgBillingTabProps {
  orgId: string;
  isOwner: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  trial: 'Trial',
  active: 'Aktivní',
  past_due: 'Po splatnosti',
  paused: 'Pozastaveno',
  canceled: 'Zrušeno',
  cancelled: 'Zrušeno',
  expired: 'Vypršelo',
  pending: 'Čeká na aktivaci',
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('cs-CZ');
};

const getStatusClasses = (status: string | undefined): string => {
  if (status === 'active') {
    return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
  }
  if (status === 'trial') {
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
  }
  if (status === 'past_due') {
    return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
  }
  if (status === 'paused') {
    return 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300';
  }
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
};

export const OrgBillingTab: React.FC<OrgBillingTabProps> = ({ orgId }) => {
  const [subscription, setSubscription] = useState<OrgSubscriptionInfo | null>(null);
  const [seatUsage, setSeatUsage] = useState<OrgSeatUsage | null>(null);
  const [history, setHistory] = useState<OrgBillingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

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
    loadData();
  }, [orgId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-slate-300 border-t-primary rounded-full" />
      </div>
    );
  }

  const currentTier = subscription?.overrideTier || subscription?.tier || 'enterprise';
  const status = subscription?.status || 'active';
  const periodStart = subscription?.billingPeriodStart || null;
  const periodEnd = subscription?.billingPeriodEnd || subscription?.expiresAt || null;
  const billingContact = subscription?.billingContact || 'Nenastaveno';
  const orgName = subscription?.orgName || 'organizace';
  const licenseChangeHref = `mailto:martin@tenderflow.cz?subject=${encodeURIComponent(`Změna počtu licencí - ${orgName}`)}&body=${encodeURIComponent(
    `Dobrý den,\n\nrádi bychom upravili počet Enterprise licencí pro organizaci ${orgName}.\n\nAktuální využití: ${seatUsage?.billableSeats ?? 0}/${seatUsage?.maxSeats ?? 0} licencí.\n\nProsím kontaktujte nás s dalším postupem.\n`,
  )}`;

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Enterprise smlouva & licence
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Fakturace je řízená smluvně. V aplikaci vidíte aktivní stav organizace,
            období smlouvy a využití licencí.
          </p>
        </div>
        <button
          onClick={loadData}
          className="self-start sm:self-auto px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          Obnovit
        </button>
      </div>

      <div className="bg-gradient-to-r from-emerald-500/10 to-primary/5 border border-emerald-500/20 rounded-xl p-5 flex flex-col lg:flex-row gap-5">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0 bg-gradient-to-br from-emerald-500 to-emerald-700">
          <span className="material-symbols-outlined text-[24px]">diamond</span>
        </div>
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Plán</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {getTierLabel(currentTier as any)}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Status</div>
            <span className={`inline-block mt-1 px-2.5 py-1 text-xs font-bold rounded-lg ${getStatusClasses(status)}`}>
              {STATUS_LABELS[status] || status}
            </span>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Období</div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {formatDate(periodStart)} - {formatDate(periodEnd)}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Billing kontakt</div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
              {billingContact}
            </div>
          </div>
        </div>
      </div>

      {seatUsage && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-slate-400">group</span>
              Firemní licence
            </h4>
            <a
              href={licenseChangeHref}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-primary hover:opacity-90 transition-opacity"
            >
              Změnit počet licencí
            </a>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="text-sm text-slate-500">
              Obsazeno <strong className="text-slate-700 dark:text-slate-200">{seatUsage.billableSeats}</strong> z <strong className="text-slate-700 dark:text-slate-200">{seatUsage.maxSeats}</strong> licencí
            </div>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden max-w-md">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.min((seatUsage.billableSeats / Math.max(seatUsage.maxSeats, 1)) * 100, 100)}%` }}
            />
          </div>
          {seatUsage.availableSeats <= 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-300 mt-3">
              Všechny licence jsou obsazené. Další členy lze přidat až po navýšení limitu.
            </p>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-slate-400">contract</span>
          Jak se fakturace řídí
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-600 dark:text-slate-400">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Smluvní cena</div>
            Cena se domlouvá podle rozsahu firmy, podpory a počtu licencí.
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Seat limit</div>
            Admini mohou přidávat uživatele jen do nastaveného limitu licencí.
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Interní správa</div>
            Stav smlouvy, období a limit licencí nastavuje interní TenderFlow admin.
          </div>
        </div>
      </div>

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
                  {entry.tier && ` - ${getTierLabel(entry.tier as any)}`}
                  {entry.seatsCount && ` (${entry.seatsCount} seats)`}
                </span>
                <span className={`text-sm font-medium ${
                  entry.status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'
                }`}>
                  {formatOrgPrice(entry.amount)}
                  {entry.status === 'paid' && ' OK'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
