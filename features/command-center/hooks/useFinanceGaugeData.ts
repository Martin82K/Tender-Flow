import { useMemo } from "react";
import { useProjectPortfolioState } from "@features/projects/model/useProjectPortfolioState";
import type { CommandCenterFilterState } from "@features/command-center/types";
import { matchesFilter } from "./filterUtils";

export interface FinanceGaugeData {
  totalBudget: number;
  contracted: number;
  pipeline: number;
}

const parsePrice = (value?: string): number => {
  if (!value) return 0;
  const n = parseInt(value.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

export const useFinanceGaugeData = (filter: CommandCenterFilterState): FinanceGaugeData => {
  const { projects, allProjectDetails } = useProjectPortfolioState();

  return useMemo(() => {
    let totalBudget = 0;
    let contracted = 0;
    let pipeline = 0;

    for (const project of projects) {
      if (project.status === "archived") continue;
      if (!matchesFilter(project, filter)) continue;
      const details = allProjectDetails[project.id];
      if (!details) continue;

      for (const cat of details.categories ?? []) {
        const budget = cat.sodBudget || cat.planBudget || 0;
        totalBudget += budget;
        const bids = details.bids?.[cat.id] ?? [];
        const sodBid = bids.find((b) => b.status === "sod");
        if (sodBid) {
          contracted += parsePrice(sodBid.price) || budget;
        } else if (cat.status !== "closed") {
          pipeline += budget;
        }
      }
    }

    return { totalBudget, contracted, pipeline };
  }, [projects, allProjectDetails, filter]);
};
