import React from "react";
import type { ModuleProps } from "@features/command-center/types";
import { useFinanceGaugeData } from "@features/command-center/hooks/useFinanceGaugeData";

const formatCZK = (value: number) => {
  if (!Number.isFinite(value) || value === 0) return "0 Kč";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M Kč`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} tis. Kč`;
  return `${Math.round(value)} Kč`;
};

export const FinanceGaugeModule: React.FC<ModuleProps> = ({ filterState }) => {
  const data = useFinanceGaugeData(filterState);

  const budgetBase = Math.max(data.totalBudget, 1);
  const contractedPct = Math.min(100, (data.contracted / budgetBase) * 100);
  const pipelinePct = Math.min(
    100 - contractedPct,
    (data.pipeline / budgetBase) * 100
  );

  return (
    <div className="cc-panel">
      <div className="cc-panel__head">
        <span className="cc-panel__title cc-panel__title--green">Finance</span>
        <span className="cc-panel__meta">portfolio</span>
      </div>
      <div className="cc-panel__body">
        <div className="cc-gauge">
          <div className="cc-gauge__row">
            <span className="cc-gauge__label">Rozpočet celkem</span>
            <span className="cc-gauge__value">{formatCZK(data.totalBudget)}</span>
          </div>
          <div className="cc-gauge__row">
            <span className="cc-gauge__label">Kontrahováno</span>
            <span className="cc-gauge__value cc-gauge__value--green">
              {formatCZK(data.contracted)}
            </span>
          </div>
          <div className="cc-gauge__row">
            <span className="cc-gauge__label">V pipeline</span>
            <span className="cc-gauge__value cc-gauge__value--blue">
              {formatCZK(data.pipeline)}
            </span>
          </div>
          <div className="cc-bar cc-bar--split">
            <span
              className="cc-bar__seg cc-bar__seg--green"
              style={{ width: `${contractedPct}%` }}
            />
            <span
              className="cc-bar__seg cc-bar__seg--blue"
              style={{ width: `${pipelinePct}%` }}
            />
          </div>
          <div className="cc-gauge__row cc-gauge__row--muted">
            <span>Volný prostor</span>
            <span>{Math.max(0, 100 - contractedPct - pipelinePct).toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
