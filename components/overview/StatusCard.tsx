import React from 'react';
import { Trophy, Hammer, Archive, TrendingUp, FileCheck, Users } from 'lucide-react';

interface StatusCardProps {
  type: 'tender' | 'realization' | 'archived';
  awardedValue: number;
  sodCount: number;
  offerCount: number;
  formatMoney: (value: number) => string;
}

const statusConfig = {
  tender: {
    label: 'Soutěž',
    icon: Trophy,
    color: {
      bg: 'bg-sky-50 dark:bg-sky-950/20',
      border: 'border-sky-200 dark:border-sky-800/50',
      iconBg: 'bg-sky-100 dark:bg-sky-900/50',
      iconColor: 'text-sky-600 dark:text-sky-400',
      accent: 'text-sky-600 dark:text-sky-400',
      progress: 'bg-sky-500',
      progressBg: 'bg-sky-200 dark:bg-sky-800/30',
    },
  },
  realization: {
    label: 'Realizace',
    icon: Hammer,
    color: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
      border: 'border-emerald-200 dark:border-emerald-800/50',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      accent: 'text-emerald-600 dark:text-emerald-400',
      progress: 'bg-emerald-500',
      progressBg: 'bg-emerald-200 dark:bg-emerald-800/30',
    },
  },
  archived: {
    label: 'Archiv',
    icon: Archive,
    color: {
      bg: 'bg-slate-50 dark:bg-slate-900/30',
      border: 'border-slate-200 dark:border-slate-700/50',
      iconBg: 'bg-slate-100 dark:bg-slate-800',
      iconColor: 'text-slate-600 dark:text-slate-400',
      accent: 'text-slate-600 dark:text-slate-400',
      progress: 'bg-slate-500',
      progressBg: 'bg-slate-200 dark:bg-slate-700/30',
    },
  },
};

export const StatusCard: React.FC<StatusCardProps> = ({
  type,
  awardedValue,
  sodCount,
  offerCount,
  formatMoney,
}) => {
  const config = statusConfig[type];
  const Icon = config.icon;
  
  const successRate = offerCount > 0 ? (sodCount / offerCount) * 100 : 0;

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl border ${config.color.border} ${config.color.bg}
        p-5 transition-all duration-200 hover:shadow-lg
      `}
    >
      {/* Header with icon and label */}
      <div className="flex items-center justify-between mb-4">
        <div className={`flex items-center gap-2 ${config.color.accent}`}>
          <div className={`w-8 h-8 rounded-lg ${config.color.iconBg} flex items-center justify-center`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold uppercase tracking-wide">
            {config.label}
          </span>
        </div>
      </div>

      {/* Main value */}
      <div className="mb-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Objem zakázek</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
          {formatMoney(awardedValue)}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-md ${config.color.iconBg} flex items-center justify-center ${config.color.iconColor}`}>
            <FileCheck className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white tabular-nums leading-none">
              {sodCount}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">SOD</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-md ${config.color.iconBg} flex items-center justify-center ${config.color.iconColor}`}>
            <Users className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white tabular-nums leading-none">
              {offerCount}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Nabídky</p>
          </div>
        </div>
      </div>

      {/* Success rate progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Úspěšnost
          </span>
          <span className={`text-xs font-semibold ${config.color.accent}`}>
            {successRate.toFixed(1)}%
          </span>
        </div>
        <div className={`h-2 rounded-full ${config.color.progressBg} overflow-hidden`}>
          <div
            className={`h-full rounded-full ${config.color.progress} transition-all duration-500`}
            style={{ width: `${Math.min(successRate, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default StatusCard;
