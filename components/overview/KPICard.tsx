import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  color?: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';
  className?: string;
}

const colorVariants = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200/50 dark:border-blue-800/50',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    iconColor: 'text-blue-600 dark:text-blue-400',
    trendUp: 'text-blue-600 dark:text-blue-400',
    trendDown: 'text-blue-600 dark:text-blue-400',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200/50 dark:border-emerald-800/50',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    trendUp: 'text-emerald-600 dark:text-emerald-400',
    trendDown: 'text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200/50 dark:border-amber-800/50',
    iconBg: 'bg-amber-100 dark:bg-amber-900/50',
    iconColor: 'text-amber-600 dark:text-amber-400',
    trendUp: 'text-amber-600 dark:text-amber-400',
    trendDown: 'text-amber-600 dark:text-amber-400',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-violet-200/50 dark:border-violet-800/50',
    iconBg: 'bg-violet-100 dark:bg-violet-900/50',
    iconColor: 'text-violet-600 dark:text-violet-400',
    trendUp: 'text-violet-600 dark:text-violet-400',
    trendDown: 'text-violet-600 dark:text-violet-400',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200/50 dark:border-rose-800/50',
    iconBg: 'bg-rose-100 dark:bg-rose-900/50',
    iconColor: 'text-rose-600 dark:text-rose-400',
    trendUp: 'text-rose-600 dark:text-rose-400',
    trendDown: 'text-rose-600 dark:text-rose-400',
  },
  slate: {
    bg: 'bg-slate-50 dark:bg-slate-900/50',
    border: 'border-slate-200/50 dark:border-slate-700/50',
    iconBg: 'bg-slate-100 dark:bg-slate-800',
    iconColor: 'text-slate-600 dark:text-slate-400',
    trendUp: 'text-slate-600 dark:text-slate-400',
    trendDown: 'text-slate-600 dark:text-slate-400',
  },
};

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'slate',
  className = '',
}) => {
  const colors = colorVariants[color];

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return <TrendingUp className="w-3.5 h-3.5" />;
    if (trend.value < 0) return <TrendingDown className="w-3.5 h-3.5" />;
    return <Minus className="w-3.5 h-3.5" />;
  };

  const getTrendColor = () => {
    if (!trend) return '';
    if (trend.value > 0) return colors.trendUp;
    if (trend.value < 0) return colors.trendDown;
    return 'text-slate-400';
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl border ${colors.border} ${colors.bg}
        p-5 transition-all duration-200 hover:shadow-lg hover:scale-[1.02]
        ${className}
      `}
    >
      {/* Background decoration */}
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 opacity-50" />
      
      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {value}
            </span>
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>{Math.abs(trend.value).toFixed(1)}%</span>
              <span className="text-slate-400 font-normal ml-1">{trend.label}</span>
            </div>
          )}
        </div>
        
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${colors.iconBg} flex items-center justify-center ${colors.iconColor}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default KPICard;
