import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface SuccessRateChartProps {
  sodCount: number;
  offerCount: number;
  size?: 'sm' | 'md' | 'lg';
  showLegend?: boolean;
  title?: string;
}

export const SuccessRateChart: React.FC<SuccessRateChartProps> = ({
  sodCount,
  offerCount,
  size = 'md',
  showLegend = true,
  title,
}) => {
  const successRate = offerCount > 0 ? (sodCount / offerCount) * 100 : 0;
  const remainingRate = 100 - successRate;

  const data = [
    { name: 'Úspěšné (SOD)', value: sodCount, color: '#10B981' },
    { name: 'Ostatní', value: Math.max(offerCount - sodCount, 0), color: '#E2E8F0' },
  ];

  const sizeConfig = {
    sm: { width: 120, height: 120, outerRadius: 50, innerRadius: 35 },
    md: { width: 180, height: 180, outerRadius: 75, innerRadius: 55 },
    lg: { width: 240, height: 240, outerRadius: 100, innerRadius: 75 },
  };

  const config = sizeConfig[size];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 shadow-lg">
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {payload[0].name}: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col items-center">
      {title && (
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{title}</h4>
      )}
      
      <div className="relative" style={{ width: config.width, height: config.height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={config.innerRadius}
              outerRadius={config.outerRadius}
              paddingAngle={2}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {successRate.toFixed(1)}%
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">úspěšnost</span>
        </div>
      </div>

      {showLegend && (
        <div className="mt-4 flex items-center gap-4">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-slate-600 dark:text-slate-300">
                {item.name}: <strong>{item.value}</strong>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SuccessRateChart;
