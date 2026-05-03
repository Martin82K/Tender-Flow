/**
 * OrgOverviewTab
 *
 * Organization dashboard overview — plan summary, seat usage,
 * next payment info, and activity stats.
 */

import React, { useEffect, useState } from 'react';
import { getOrgSubscription, getOrgSeatUsage } from '../api/orgBillingService';
import { getTierLabel, getTierBadgeClass } from '@/config/subscriptionTiers';
import { organizationService } from '@/services/organizationService';
import type { OrgSubscriptionInfo, OrgSeatUsage, OrgSubTab } from '../model/types';
import type { OrganizationUnlockerTimeSavings } from '@/services/organizationService';

interface OrgOverviewTabProps {
  orgId: string;
  orgName: string;
  isOwner: boolean;
  onNavigate: (tab: OrgSubTab) => void;
}

const formatMinutes = (minutes: number | null | undefined): string => {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) return '0 min';
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
};

export const OrgOverviewTab: React.FC<OrgOverviewTabProps> = ({
  orgId,
  orgName,
}) => {
  const [subscription, setSubscription] = useState<OrgSubscriptionInfo | null>(null);
  const [seatUsage, setSeatUsage] = useState<OrgSeatUsage | null>(null);
  const [timeSavings, setTimeSavings] = useState<OrganizationUnlockerTimeSavings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [sub, seats, savings] = await Promise.all([
          getOrgSubscription(orgId),
          getOrgSeatUsage(orgId),
          organizationService.getOrganizationUnlockerTimeSavings(orgId, 30, 2).catch(() => null),
        ]);
        setSubscription(sub);
        setSeatUsage(seats);
        setTimeSavings(savings);
      } catch (err) {
        console.error('[OrgOverviewTab] Failed to load:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orgId]);

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
        Nepodařilo se načíst informace o organizaci.
      </div>
    );
  }

  const effectiveTier = subscription.overrideTier || subscription.tier;
  const isOverridden = !!subscription.overrideTier;
  const seatPercent = seatUsage ? Math.round((seatUsage.billableSeats / seatUsage.maxSeats) * 100) : 0;
  const licenseChangeHref = `mailto:martin@tenderflow.cz?subject=${encodeURIComponent(`Změna počtu licencí - ${orgName}`)}&body=${encodeURIComponent(
    `Dobrý den,\n\nrádi bychom upravili počet Enterprise licencí pro organizaci ${orgName}.\n\nAktuální využití: ${seatUsage?.billableSeats ?? 0}/${seatUsage?.maxSeats ?? 0} licencí.\n\nProsím kontaktujte nás s dalším postupem.\n`,
  )}`;

  return (
    <section className="space-y-6">
      {/* Plan Summary Card */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/0 border border-primary/20 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white text-2xl flex-shrink-0">
          <span className="material-symbols-outlined text-[28px]">bolt</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              {getTierLabel(effectiveTier as any)}
            </h3>
            {isOverridden && (
              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold rounded">
                ZVÝHODNĚNO
              </span>
            )}
            <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded border ${getTierBadgeClass(effectiveTier as any)}`}>
              {subscription.status === 'active' ? 'Aktivní' : subscription.status === 'trial' ? 'Trial' : subscription.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Smluvní Enterprise účet
            {(subscription.billingPeriodEnd || subscription.expiresAt) && (
              <> · Aktivní do <strong className="text-primary">{new Date(subscription.billingPeriodEnd || subscription.expiresAt || '').toLocaleDateString('cs-CZ')}</strong></>
            )}
            {seatUsage && (
              <> · {seatUsage.billableSeats}/{seatUsage.maxSeats} licencí obsazeno</>
            )}
          </p>
        </div>
        <div className="flex flex-col sm:items-end gap-2">
          <a
            href={licenseChangeHref}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-primary to-primary/90 text-white hover:opacity-90 transition-opacity"
          >
            Změnit počet licencí
          </a>
          <div className="text-sm text-slate-500 dark:text-slate-400 sm:text-right">
            Změny licencí nastavuje poskytovatel služby.
          </div>
        </div>
      </div>

      {/* Seat Usage Bar */}
      {seatUsage && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Obsazenost licencí
            </h4>
            <span className="text-sm text-slate-500">
              <strong className="text-primary">{seatUsage.billableSeats}</strong> z {seatUsage.maxSeats} licencí
            </span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(seatPercent, 100)}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-400">
            <span>{seatUsage.availableSeats} volných licencí</span>
          </div>
        </div>
      )}

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Next Payment */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-slate-400">calendar_today</span>
            Smluvní období
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Datum</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {subscription.billingPeriodEnd || subscription.expiresAt
                  ? new Date(subscription.billingPeriodEnd || subscription.expiresAt || '').toLocaleDateString('cs-CZ')
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Fakturace</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Smluvně
              </span>
            </div>
          </div>
        </div>

        {/* Activity Stats */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-slate-400">bar_chart</span>
            Aktivita (30 dní)
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Členů v organizaci</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {seatUsage?.usedSeats || 0}
              </span>
            </div>
            {timeSavings && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Odemčených Excel souborů</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {timeSavings.unlocked_sheets_range}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Úspora času (Excel)</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    ~{formatMinutes(timeSavings.minutes_saved_range)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
