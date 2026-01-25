import React from 'react';
import { ContractWithDetails, ProjectDetails } from '../../../types';

interface ContractsOverviewProps {
  contracts: ContractWithDetails[];
  projectDetails?: ProjectDetails;
}

const formatMoney = (value: number): string => {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)} %`;
};

export const ContractsOverview: React.FC<ContractsOverviewProps> = ({ contracts, projectDetails }) => {
  // Calculate KPIs
  const totalContracts = contracts.length;
  const activeContracts = contracts.filter(c => c.status === 'active').length;
  const draftContracts = contracts.filter(c => c.status === 'draft').length;

  const totalBasePrice = contracts.reduce((sum, c) => sum + c.basePrice, 0);
  const totalCurrentValue = contracts.reduce((sum, c) => sum + c.currentTotal, 0);
  const totalAmendmentsValue = totalCurrentValue - totalBasePrice;
  const totalApproved = contracts.reduce((sum, c) => sum + c.approvedSum, 0);
  const totalRemaining = contracts.reduce((sum, c) => sum + c.remaining, 0);

  // Calculate retention
  const totalRetention = contracts.reduce((sum, c) => {
    if (c.retentionAmount) return sum + c.retentionAmount;
    if (c.retentionPercent) return sum + (c.currentTotal * c.retentionPercent / 100);
    return sum;
  }, 0);

  // Progress percentage
  const progressPercent = totalCurrentValue > 0 ? (totalApproved / totalCurrentValue) : 0;

  // Recent activity - last 5 contracts or amendments
  const recentContracts = [...contracts]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
    .slice(0, 5);

  const kpiCards = [
    {
      label: 'Celkem smluv',
      value: totalContracts.toString(),
      subValue: `${activeContracts} aktivních, ${draftContracts} rozpracovaných`,
      icon: 'description',
      color: 'blue',
    },
    {
      label: 'Celková hodnota',
      value: formatMoney(totalCurrentValue),
      subValue: totalAmendmentsValue !== 0
        ? `Původní: ${formatMoney(totalBasePrice)} (${totalAmendmentsValue > 0 ? '+' : ''}${formatMoney(totalAmendmentsValue)} dodatky)`
        : `Bez dodatků`,
      icon: 'payments',
      color: 'emerald',
    },
    {
      label: 'Schválené čerpání',
      value: formatMoney(totalApproved),
      subValue: `${formatPercent(progressPercent)} z celkové hodnoty`,
      icon: 'account_balance',
      color: 'amber',
    },
    {
      label: 'Zbývá vyčerpat',
      value: formatMoney(totalRemaining),
      subValue: totalRetention > 0 ? `Včetně pozastávky ${formatMoney(totalRetention)}` : 'Bez pozastávky',
      icon: 'trending_down',
      color: 'purple',
    },
  ];

  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  };

  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">
          description
        </span>
        <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">
          Zatím žádné smlouvy
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-500 max-w-md">
          Začněte přidáním první smlouvy v záložce "Smlouvy" nebo vytvořte smlouvu přímo z vítězného bidu ve výběrovém řízení.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, index) => (
          <div
            key={index}
            className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-start justify-between mb-3">
              <span className={`p-2 rounded-xl ${colorClasses[kpi.color as keyof typeof colorClasses]}`}>
                <span className="material-symbols-outlined text-xl">{kpi.icon}</span>
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
              {kpi.value}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide mb-1">
              {kpi.label}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {kpi.subValue}
            </p>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Celkové čerpání
          </h3>
          <span className="text-sm font-bold text-primary">
            {formatPercent(progressPercent)}
          </span>
        </div>
        <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progressPercent * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>Schváleno: {formatMoney(totalApproved)}</span>
          <span>Celkem: {formatMoney(totalCurrentValue)}</span>
        </div>
      </div>

      {/* Recent Contracts */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Poslední aktivita
          </h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {recentContracts.map((contract) => (
            <div key={contract.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${
                  contract.status === 'active' ? 'bg-emerald-500' :
                  contract.status === 'draft' ? 'bg-amber-500' :
                  contract.status === 'closed' ? 'bg-slate-400' : 'bg-red-500'
                }`} />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {contract.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {contract.vendorName}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {formatMoney(contract.currentTotal)}
                </p>
                <p className="text-xs text-slate-500">
                  {contract.amendments.length > 0 && `+${contract.amendments.length} dodatků`}
                  {contract.amendments.length > 0 && contract.drawdowns.length > 0 && ' • '}
                  {contract.drawdowns.length > 0 && `${contract.drawdowns.length} průvodek`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contracts by Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Status */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4">
            Smlouvy podle stavu
          </h3>
          <div className="space-y-3">
            {[
              { status: 'active', label: 'Aktivní', color: 'bg-emerald-500' },
              { status: 'draft', label: 'Rozpracované', color: 'bg-amber-500' },
              { status: 'closed', label: 'Uzavřené', color: 'bg-slate-400' },
              { status: 'cancelled', label: 'Zrušené', color: 'bg-red-500' },
            ].map(({ status, label, color }) => {
              const count = contracts.filter(c => c.status === status).length;
              const value = contracts.filter(c => c.status === status).reduce((sum, c) => sum + c.currentTotal, 0);
              if (count === 0) return null;

              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${color}`} />
                    <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{count}×</span>
                    <span className="text-sm text-slate-500">{formatMoney(value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Vendor */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4">
            Top dodavatelé
          </h3>
          <div className="space-y-3">
            {Object.entries(
              contracts.reduce((acc, c) => {
                if (!acc[c.vendorName]) acc[c.vendorName] = { count: 0, value: 0 };
                acc[c.vendorName].count++;
                acc[c.vendorName].value += c.currentTotal;
                return acc;
              }, {} as Record<string, { count: number; value: number }>)
            )
              .sort((a, b) => b[1].value - a[1].value)
              .slice(0, 5)
              .map(([vendor, data]) => (
                <div key={vendor} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                    {vendor}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {data.count}×
                    </span>
                    <span className="text-sm text-slate-500">{formatMoney(data.value)}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
