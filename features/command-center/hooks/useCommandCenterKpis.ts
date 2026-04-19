import { useMemo } from "react";
import { useAppData } from "@/hooks/useAppData";
import { useUI } from "@/context/UIContext";
import type { CommandCenterFilterState } from "@features/command-center/types";
import { matchesFilter } from "./filterUtils";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MIN_SUPPLIERS = 3;

export interface CommandCenterKpis {
  pipelineVolume: number;
  pipelineCategoriesCount: number;
  demandsAtRisk: number;
  underseededCategories: number;
  bidsToEvaluate: number;
  contractsToSign: number;
  budgetSavings: number;
}

const parsePriceToNumber = (price?: string): number => {
  if (!price) return 0;
  const n = parseInt(price.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

export const useCommandCenterKpis = (filter: CommandCenterFilterState): CommandCenterKpis => {
  const { showUiModal } = useUI();
  const { state } = useAppData(showUiModal);
  const { projects, allProjectDetails } = state;

  return useMemo(() => {
    const now = new Date();
    let pipelineVolume = 0;
    let pipelineCategoriesCount = 0;
    let demandsAtRisk = 0;
    let underseededCategories = 0;
    let bidsToEvaluate = 0;
    let contractsToSign = 0;
    let budgetTotal = 0;
    let contractedSum = 0;

    for (const project of projects) {
      if (project.status === "archived") continue;
      if (!matchesFilter(project, filter)) continue;
      const details = allProjectDetails[project.id];
      if (!details) continue;

      for (const cat of details.categories ?? []) {
        const bids = details.bids?.[cat.id] ?? [];
        const isOpen = cat.status !== "closed" && cat.status !== "sod";

        if (isOpen) {
          pipelineCategoriesCount += 1;
          pipelineVolume += cat.planBudget || cat.sodBudget || 0;
        }

        if (isOpen && cat.createdAt) {
          const created = new Date(cat.createdAt);
          const dueAt = created.getTime() + 14 * MS_PER_DAY;
          const daysLeft = Math.floor((dueAt - now.getTime()) / MS_PER_DAY);
          if (daysLeft <= 2) demandsAtRisk += 1;
        }

        if (isOpen && bids.length < MIN_SUPPLIERS) {
          underseededCategories += 1;
        }

        for (const bid of bids) {
          if (bid.status === "offer") bidsToEvaluate += 1;
          if (bid.status === "sod" && !bid.contracted) contractsToSign += 1;
        }

        budgetTotal += cat.sodBudget || 0;
        const winner = bids.find((b) => b.status === "sod");
        if (winner) {
          contractedSum += parsePriceToNumber(winner.price);
        }
      }
    }

    const budgetSavings = budgetTotal - contractedSum;

    return {
      pipelineVolume,
      pipelineCategoriesCount,
      demandsAtRisk,
      underseededCategories,
      bidsToEvaluate,
      contractsToSign,
      budgetSavings,
    };
  }, [projects, allProjectDetails, filter]);
};
