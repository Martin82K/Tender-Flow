import React from 'react';
import {
  Wallet,
  Target,
  Users,
  FolderKanban,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Hammer,
  Archive,
  FileCheck,
  Building2,
  Coins,
  Award,
} from 'lucide-react';
import { KPICard } from './KPICard';
import { StatusCard } from './StatusCard';
import { SupplierBarChart } from './SupplierBarChart';
import { SuccessRateChart } from './SuccessRateChart';
import { SupplierTable } from './SupplierTable';
import type { OverviewAnalytics } from '../../utils/overviewAnalytics';

interface SupplierRow {
  id: string;
  name: string;
  rating?: number;
  ratingCount?: number;
  offerCount: number;
  sodCount: number;
  lastAwardedLabel?: string;
  subcontractorId?: string;
  totalAwardedValue: number;
  offers: any[];
}

interface OverviewDashboardProps {
  analytics: OverviewAnalytics;
  suppliers: SupplierRow[];
  formatMoney: (value: number) => string;
  onSupplierClick?: (supplier: SupplierRow) => void;
  selectedSupplierId?: string;
  showAllSuppliers?: boolean;
  onToggleShowAll?: () => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  analytics,
  suppliers,
  formatMoney,
  onSupplierClick,
  selectedSupplierId,
  showAllSuppliers = false,
  onToggleShowAll,
}) => {
  const successRate = analytics.totals.offerCount > 0
    ? (analytics.totals.sodCount / analytics.totals.offerCount) * 100
    : 0;

  const displaySuppliers = showAllSuppliers ? suppliers : suppliers.slice(0, 6);

  // Prepare data for bar charts
  const topSuppliersBySOD = [...suppliers]
    .sort((a, b) => b.sodCount - a.sodCount)
    .slice(0, 6)
    .map(s => ({
      label: s.name,
      value: s.sodCount,
      helper: `${s.offerCount} nabídek`,
    }));

  const topSuppliersByValue = [...suppliers]
    .sort((a, b) => b.totalAwardedValue - a.totalAwardedValue)
    .slice(0, 6)
    .map(s => ({
      label: s.name,
      value: s.totalAwardedValue,
      helper: s.lastAwardedLabel || 'Bez ocenění',
    }));

  const yearTrendsData = analytics.yearTrends.map(t => ({
    label: t.year.toString(),
    value: t.awardedValue,
    helper: `${t.sodCount} SOD`,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Objem zakázek"
          value={formatMoney(analytics.totals.awardedValue)}
          subtitle="Celkový objem oceněných zakázek"
          icon={<Wallet className="w-6 h-6" />}
          color="emerald"
        />
        <KPICard
          title="Úspěšnost VŘ"
          value={`${successRate.toFixed(1)}%`}
          subtitle={`${analytics.totals.sodCount} SOD z ${analytics.totals.offerCount} nabídek`}
          icon={<Target className="w-6 h-6" />}
          color="blue"
        />
        <KPICard
          title="Počet dodavatelů"
          value={analytics.suppliers.length}
          subtitle="Aktivní dodavatelé v systému"
          icon={<Users className="w-6 h-6" />}
          color="violet"
        />
        <KPICard
          title="Kategorie s daty"
          value={analytics.categoryProfit.length}
          subtitle="Kategorie s oceněnými nabídkami"
          icon={<FolderKanban className="w-6 h-6" />}
          color="amber"
        />
      </div>

      {/* Status Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          type="tender"
          awardedValue={analytics.totalsByStatus.tender.awardedValue}
          sodCount={analytics.totalsByStatus.tender.sodCount}
          offerCount={analytics.totalsByStatus.tender.offerCount}
          formatMoney={formatMoney}
        />
        <StatusCard
          type="realization"
          awardedValue={analytics.totalsByStatus.realization.awardedValue}
          sodCount={analytics.totalsByStatus.realization.sodCount}
          offerCount={analytics.totalsByStatus.realization.offerCount}
          formatMoney={formatMoney}
        />
        <StatusCard
          type="archived"
          awardedValue={analytics.totalsByStatus.archived.awardedValue}
          sodCount={analytics.totalsByStatus.archived.sodCount}
          offerCount={analytics.totalsByStatus.archived.offerCount}
          formatMoney={formatMoney}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Suppliers by SOD */}
        <SupplierBarChart
          items={topSuppliersBySOD}
          title="Nejčastěji zasmluvňovaní"
          subtitle="Dodavatelé podle počtu SOD"
          color="emerald"
        />

        {/* Top Suppliers by Value */}
        <SupplierBarChart
          items={topSuppliersByValue}
          valueFormatter={formatMoney}
          title="Nejvyšší objemy"
          subtitle="Dodavatelé podle oceněných zakázek"
          color="blue"
        />

        {/* Success Rate Donut Chart */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 flex flex-col items-center justify-center">
          <SuccessRateChart
            sodCount={analytics.totals.sodCount}
            offerCount={analytics.totals.offerCount}
            size="md"
            title="Celková úspěšnost"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Analýza dodavatelů
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Hodnocení, četnost SOD, nabídky a úspěšnost
              </p>
            </div>
          </div>
          {onToggleShowAll && (
            <button
              onClick={onToggleShowAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {showAllSuppliers ? 'Zobrazit méně' : 'Zobrazit vše'}
            </button>
          )}
        </div>

        <SupplierTable
          suppliers={displaySuppliers}
          onSupplierClick={onSupplierClick}
          selectedSupplierId={selectedSupplierId}
        />
      </div>

      {/* Trends Section */}
      {analytics.yearTrends.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Trendy v čase
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Objemy zakázek a aktivita po letech
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SupplierBarChart
              items={yearTrendsData}
              valueFormatter={formatMoney}
              title="Objem oceněných zakázek"
              subtitle="Podle roku ocenění"
              color="violet"
            />
            <SupplierBarChart
              items={analytics.yearTrends.map(t => ({
                label: t.year.toString(),
                value: t.offerCount,
                helper: `${t.categoryCount} kategorií`,
              }))}
              title="Aktivita nabídek"
              subtitle="Počet nabídek podle roku"
              color="amber"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewDashboard;
