import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { CheckCircle2, Star, FileText, XCircle, Mail, Send } from 'lucide-react';

interface StatusDistributionChartProps {
  sodCount: number;
  shortlistCount: number;
  offerCount: number;
  rejectedCount: number;
  contactedCount: number;
  sentCount: number;
}

export const StatusDistributionChart: React.FC<StatusDistributionChartProps> = ({
  sodCount,
  shortlistCount,
  offerCount,
  rejectedCount,
  contactedCount,
  sentCount,
}) => {
  const data = [
    { name: 'SOD', value: sodCount, color: '#10B981', icon: CheckCircle2 },
    { name: 'Užší výběr', value: shortlistCount, color: '#F59E0B', icon: Star },
    { name: 'Nabídka', value: offerCount, color: '#0EA5E9', icon: FileText },
    { name: 'Zamítnuto', value: rejectedCount, color: '#F43F5E', icon: XCircle },
    { name: 'Oslovení', value: contactedCount, color: '#64748B', icon: Mail },
    { name: 'Odesláno', value: sentCount, color: '#8B5CF6', icon: Send },
  ].filter(item => item.value > 0);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 shadow-lg">
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {item.name}: {item.value}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {percentage}% z celkem
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 text-center">
        Rozdělení nabídek podle statusu
      </h4>
      
      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend with counts */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
        {data.map((item) => {
          const Icon = item.icon;
          const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
          return (
            <div key={item.name} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
                {item.name}
              </span>
              <span className="text-xs font-semibold text-slate-900 dark:text-white ml-auto">
                {item.value}
              </span>
              <span className="text-xs text-slate-400 w-8 text-right">
                {percentage}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatusDistributionChart;
