import React from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { formatDecimal } from "@/shared/formatting/decimalFormatters";

interface BudgetDeviationGaugeProps {
  avgDeviationPercent: number | null;
}

export const BudgetDeviationGauge: React.FC<BudgetDeviationGaugeProps> = ({
  avgDeviationPercent,
}) => {
  const clampedValue = avgDeviationPercent === null
    ? 0
    : Math.max(-30, Math.min(30, avgDeviationPercent));
  const markerPosition = ((clampedValue + 30) / 60) * 100;
  const absoluteValue = avgDeviationPercent === null ? null : Math.abs(avgDeviationPercent);
  const formattedValue = absoluteValue === null
    ? "—"
    : formatDecimal(absoluteValue, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const isBelow = avgDeviationPercent !== null && avgDeviationPercent < 0;
  const isAbove = avgDeviationPercent !== null && avgDeviationPercent > 0;
  const summary = avgDeviationPercent === null
    ? "Bez dat pro výpočet odchylky"
    : avgDeviationPercent === 0
      ? "V souladu se smluvní cenou"
      : `${formattedValue} % ${isBelow ? "pod" : "nad"} smluvní cenou`;
  const valueColor = avgDeviationPercent === null
    ? "var(--tf-overview-gauge-muted, #64748B)"
    : isBelow
      ? "var(--tf-overview-gauge-good, #10B981)"
      : avgDeviationPercent <= 5
        ? "var(--tf-overview-gauge-neutral, #F59E0B)"
        : "var(--tf-overview-gauge-danger, #EF4444)";
  const Icon = avgDeviationPercent === null
    ? Minus
    : isBelow
      ? TrendingDown
      : isAbove
        ? TrendingUp
        : Minus;

  return (
    <div data-help-id="overview-budget-deviation-gauge" className="flex h-full min-w-0 flex-col">
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
          Průměrná nabídková cena proti smluvní ceně s investorem
        </h4>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Záporná hodnota znamená úsporu proti ceně investora
        </p>
      </div>

      <div className="mb-7 flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-current/20"
          style={{ color: valueColor }}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <div className="text-2xl font-bold tabular-nums tracking-tight" style={{ color: valueColor }}>
            {avgDeviationPercent === null
              ? "—"
              : `${avgDeviationPercent > 0 ? "+" : ""}${formatDecimal(avgDeviationPercent, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })} %`}
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{summary}</p>
        </div>
      </div>

      <div role="img" aria-label={summary} className="mt-auto">
        <div className="relative h-4 rounded-full border border-slate-300/30 bg-[linear-gradient(90deg,var(--tf-overview-gauge-good-strong,#059669)_0%,var(--tf-overview-gauge-good,#10B981)_41.66%,var(--tf-overview-gauge-neutral,#F59E0B)_41.66%,var(--tf-overview-gauge-neutral,#F59E0B)_58.33%,var(--tf-overview-gauge-warning,#F97316)_58.33%,var(--tf-overview-gauge-danger,#EF4444)_100%)] shadow-inner">
          <span className="absolute inset-y-[-5px] left-1/2 w-px -translate-x-1/2 bg-white/80" aria-hidden="true" />
          {avgDeviationPercent !== null ? (
            <span
              className="absolute top-1/2 h-7 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_2px_8px_rgba(0,0,0,.45)]"
              style={{ left: `${markerPosition}%`, backgroundColor: valueColor }}
              aria-hidden="true"
            />
          ) : null}
        </div>
        <div className="mt-2 flex justify-between text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
          <span>−30 %</span>
          <span>0 %</span>
          <span>+30 %</span>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" aria-hidden="true" />
          <span>Cílové pásmo ±5 %</span>
        </div>
      </div>
    </div>
  );
};

export default BudgetDeviationGauge;
