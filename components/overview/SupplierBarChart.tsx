import React from 'react';
import { Building2, Coins } from 'lucide-react';

interface BarItem {
  label: string;
  value: number;
  helper?: string;
  maxValue?: number;
}

interface SupplierBarChartProps {
  items: BarItem[];
  valueFormatter?: (value: number) => string;
  color?: 'emerald' | 'blue' | 'violet' | 'amber';
  showIcon?: boolean;
  maxItems?: number;
  title?: string;
  subtitle?: string;
}

const colorVariants = {
  emerald: {
    bar: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    barBg: 'bg-emerald-100 dark:bg-emerald-900/20',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  blue: {
    bar: 'bg-gradient-to-r from-blue-500 to-blue-400',
    barBg: 'bg-blue-100 dark:bg-blue-900/20',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  violet: {
    bar: 'bg-gradient-to-r from-violet-500 to-violet-400',
    barBg: 'bg-violet-100 dark:bg-violet-900/20',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
  amber: {
    bar: 'bg-gradient-to-r from-amber-500 to-amber-400',
    barBg: 'bg-amber-100 dark:bg-amber-900/20',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
};

export const SupplierBarChart: React.FC<SupplierBarChartProps> = ({
  items,
  valueFormatter = (v) => v.toLocaleString('cs-CZ'),
  color = 'emerald',
  showIcon = true,
  maxItems,
  title,
  subtitle,
}) => {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
        {title && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
        )}
        <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
          Zatím bez dat.
        </div>
      </div>
    );
  }

  const displayItems = maxItems ? items.slice(0, maxItems) : items;
  const max = Math.max(...displayItems.map((item) => item.value), 1);
  const colors = colorVariants[color];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      {title && (
        <div className="mb-5">
          <div className="flex items-center gap-2">
            {showIcon && (
              <div className={`w-8 h-8 rounded-lg ${colors.iconBg} flex items-center justify-center ${colors.iconColor}`}>
                <Building2 className="w-4 h-4" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {displayItems.map((item, index) => {
          const width = Math.max((item.value / max) * 100, 3);
          const isTopThree = index < 3;
          
          return (
            <div key={item.label} className="group">
              <div className="flex items-center gap-3">
                {/* Rank badge for top 3 */}
                <div className={`
                  flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${isTopThree 
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }
                `}>
                  {index + 1}
                </div>
                
                {/* Supplier name */}
                <div className="flex-shrink-0 w-40 text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                  {item.label}
                </div>
                
                {/* Progress bar */}
                <div className={`flex-1 h-2.5 rounded-full ${colors.barBg} overflow-hidden`}>
                  <div
                    className={`h-full rounded-full ${colors.bar} transition-all duration-500 ease-out group-hover:opacity-80`}
                    style={{ width: `${width}%` }}
                  />
                </div>
                
                {/* Value */}
                <div className="flex-shrink-0 w-24 text-right">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                    {valueFormatter(item.value)}
                  </span>
                </div>
              </div>
              
              {/* Helper text */}
              {item.helper && (
                <div className="ml-9 mt-0.5 text-xs text-slate-400 dark:text-slate-500 truncate">
                  {item.helper}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Alternative version for money values
export const MoneyBarChart: React.FC<Omit<SupplierBarChartProps, 'color'>> = (props) => (
  <SupplierBarChart {...props} color="emerald" />
);

// Alternative version for count values  
export const CountBarChart: React.FC<Omit<SupplierBarChartProps, 'color'>> = (props) => (
  <SupplierBarChart {...props} color="blue" />
);

export default SupplierBarChart;
