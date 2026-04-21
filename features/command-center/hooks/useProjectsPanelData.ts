import { useMemo } from "react";
import { useAppData } from "@/hooks/useAppData";
import { useUI } from "@/context/UIContext";
import type { CommandCenterFilterState } from "@features/command-center/types";
import { computeProjectHealth, matchesFilter, matchesHealthFilter } from "./filterUtils";

export interface ProjectPanelRow {
  id: string;
  name: string;
  location: string;
  health: "ok" | "warn" | "crit";
  coveragePct: number;
  nextDeadlineLabel: string | null;
  budget: number;
  estimate: number;
}

const parsePrice = (value?: string): number => {
  if (!value) return 0;
  const n = parseInt(value.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

const formatRelativeDate = (date: Date): string => {
  const days = Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `po DDL ${Math.abs(days)} d`;
  if (days === 0) return "dnes";
  if (days === 1) return "zítra";
  if (days <= 14) return `za ${days} d`;
  return date.toLocaleDateString("cs-CZ");
};

export const useProjectsPanelData = (filter: CommandCenterFilterState): ProjectPanelRow[] => {
  const { showUiModal } = useUI();
  const { state } = useAppData(showUiModal);
  const { projects, allProjectDetails } = state;

  return useMemo(() => {
    const rows: ProjectPanelRow[] = [];
    const now = new Date();

    for (const project of projects) {
      if (project.status === "archived") continue;
      if (!matchesFilter(project, filter)) continue;
      const details = allProjectDetails[project.id];
      const health = computeProjectHealth(project, details, now);
      if (!matchesHealthFilter(health.level, filter)) continue;

      const categories = details?.categories ?? [];
      const deadlines = categories
        .map((c) => (c.deadline ? new Date(c.deadline) : null))
        .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
      const nextDeadline = deadlines.find((d) => d.getTime() >= now.getTime()) ?? deadlines[0];

      let budget = 0;
      let estimate = 0;
      for (const cat of categories) {
        budget += cat.sodBudget || cat.planBudget || 0;
        const bids = details?.bids?.[cat.id] ?? [];
        const winner = bids.find((b) => b.status === "sod") ?? bids.find((b) => b.status === "shortlist");
        estimate += winner ? parsePrice(winner.price) : cat.planBudget || 0;
      }

      rows.push({
        id: project.id,
        name: project.name,
        location: project.location,
        health: health.level,
        coveragePct: health.coveragePct,
        nextDeadlineLabel: nextDeadline ? formatRelativeDate(nextDeadline) : null,
        budget,
        estimate,
      });
    }

    const healthRank = { crit: 0, warn: 1, ok: 2 } as const;
    return rows.sort((a, b) => healthRank[a.health] - healthRank[b.health]);
  }, [projects, allProjectDetails, filter]);
};
