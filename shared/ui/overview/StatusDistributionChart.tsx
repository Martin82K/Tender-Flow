import React from "react";
import { CheckCircle2, FileText, Mail, Send, Star, XCircle } from "lucide-react";
import { formatDecimal } from "@/shared/formatting/decimalFormatters";

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
    { name: "SOD", value: sodCount, color: "var(--tf-overview-status-sod, #10B981)", icon: CheckCircle2 },
    { name: "Užší výběr", value: shortlistCount, color: "var(--tf-overview-status-shortlist, #F59E0B)", icon: Star },
    { name: "Nabídka", value: offerCount, color: "var(--tf-overview-status-offer, #0EA5E9)", icon: FileText },
    { name: "Zamítnuto", value: rejectedCount, color: "var(--tf-overview-status-rejected, #F43F5E)", icon: XCircle },
    { name: "Oslovení", value: contactedCount, color: "var(--tf-overview-status-contacted, #64748B)", icon: Mail },
    { name: "Odesláno", value: sentCount, color: "var(--tf-overview-status-sent, #8B5CF6)", icon: Send },
  ].filter((item) => item.value > 0);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div data-help-id="overview-status-distribution-chart" className="flex h-full min-w-0 flex-col">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            Rozdělení nabídek podle statusu
          </h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Přímé porovnání aktuálních fází
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
          Celkem {total} nabídek
        </span>
      </div>

      {total === 0 ? (
        <div className="flex min-h-40 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
          Pro zvolené filtry zatím nejsou dostupná data.
        </div>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Rozdělení ${total} nabídek do ${data.length} statusů`}
            className="mb-5 flex h-3 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800"
          >
            {data.map((item) => (
              <span
                key={item.name}
                title={`${item.name}: ${item.value}`}
                className="h-full border-r border-slate-950/20 last:border-r-0"
                style={{ width: `${(item.value / total) * 100}%`, backgroundColor: item.color }}
              />
            ))}
          </div>

          <div className="space-y-3">
            {data.map((item) => {
              const Icon = item.icon;
              const percentage = (item.value / total) * 100;
              return (
                <div key={item.name} className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(5rem,1.4fr)_auto] items-center gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{item.name}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${percentage}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <div className="flex min-w-[5.5rem] items-baseline justify-end gap-2 tabular-nums">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.value}</span>
                    <span className="w-10 text-right text-xs text-slate-400">
                      {formatDecimal(percentage, { maximumFractionDigits: 0 })} %
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default StatusDistributionChart;
