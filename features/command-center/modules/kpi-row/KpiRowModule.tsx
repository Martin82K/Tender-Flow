import React from "react";
import type { ModuleProps } from "@features/command-center/types";
import { useCommandCenterKpis } from "@features/command-center/hooks/useCommandCenterKpis";

const formatCZK = (value: number) => {
  if (!Number.isFinite(value) || value === 0) return "0 Kč";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M Kč`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} tis. Kč`;
  return `${Math.round(value)} Kč`;
};

interface KpiTileSpec {
  key: string;
  label: string;
  value: string;
  color: "blue" | "red" | "amber" | "green" | "purple";
  foot?: string;
}

export const KpiRowModule: React.FC<ModuleProps> = ({ filterState }) => {
  const kpis = useCommandCenterKpis(filterState);

  const tiles: KpiTileSpec[] = [
    {
      key: "pipeline",
      label: "Pipeline objem",
      value: formatCZK(kpis.pipelineVolume),
      color: "blue",
      foot: `${kpis.pipelineCategoriesCount} poptávek`,
    },
    {
      key: "at-risk",
      label: "Poptávky v riziku",
      value: String(kpis.demandsAtRisk),
      color: "red",
      foot: "14denní limit ≤ 2 dny",
    },
    {
      key: "underseeded",
      label: "Kategorie < 3 dod.",
      value: String(kpis.underseededCategories),
      color: "amber",
      foot: "Málo nabídek",
    },
    {
      key: "to-evaluate",
      label: "Nabídky k vyhodnocení",
      value: String(kpis.bidsToEvaluate),
      color: "blue",
      foot: "Stav: offer",
    },
    {
      key: "contracts",
      label: "Smluv k podpisu",
      value: String(kpis.contractsToSign),
      color: "purple",
      foot: "Vítězi bez smlouvy",
    },
    {
      key: "savings",
      label: "Úspora vs. rozpočet",
      value: formatCZK(kpis.budgetSavings),
      color: kpis.budgetSavings >= 0 ? "green" : "red",
      foot: kpis.budgetSavings >= 0 ? "kontrahováno < cíl" : "přetečení",
    },
  ];

  return (
    <div className="cc-kpi-row">
      {tiles.map((tile) => (
        <div key={tile.key} className={`cc-kpi cc-kpi--${tile.color}`}>
          <div className="cc-kpi__head">
            <span className="cc-kpi__label">{tile.label}</span>
          </div>
          <div className="cc-kpi__number">{tile.value}</div>
          <div className="cc-kpi__spark" aria-hidden />
          {tile.foot && <div className="cc-kpi__foot">{tile.foot}</div>}
        </div>
      ))}
    </div>
  );
};
