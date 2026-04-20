import { useMemo } from "react";
import { useAppData } from "@/hooks/useAppData";
import { useUI } from "@/context/UIContext";
import type { CommandCenterFilterState } from "@features/command-center/types";
import { matchesFilter } from "./filterUtils";

export type FunnelTone = "blue" | "purple" | "amber" | "green" | "red";

export interface FunnelStage {
  key: string;
  label: string;
  subtext: string;
  count: number;
  tone: FunnelTone;
}

export interface PipelineFunnelData {
  stages: FunnelStage[];
  snapshotLabel: string;
  successPct: number;
  avgLeadDays: number | null;
  fastestCategory: { label: string; days: number } | null;
  slowestCategory: { label: string; days: number } | null;
  breaching14d: { count: number; firstLabel: string | null };
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const formatSnapshot = (date: Date): string => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  return `k ${day}. ${month}.`;
};

const pluralize = (n: number, one: string, few: string, many: string): string => {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
};

export const usePipelineFunnelData = (filter: CommandCenterFilterState): PipelineFunnelData => {
  const { showUiModal } = useUI();
  const { state } = useAppData(showUiModal);
  const { projects, allProjectDetails } = state;

  return useMemo(() => {
    const now = new Date();

    let categoriesTotal = 0;
    let openCategories = 0;
    let offersReceived = 0;
    let evaluation = 0;
    let contractDraft = 0;
    let awaitingSignature = 0;
    let realization = 0;

    let signedCount = 0;
    let leadDaysSum = 0;
    let leadDaysCount = 0;

    type CatTiming = { label: string; days: number };
    let fastest: CatTiming | null = null;
    let slowest: CatTiming | null = null;

    let breachCount = 0;
    let firstBreachLabel: string | null = null;

    const filteredProjects = projects.filter(
      (p) => p.status !== "archived" && matchesFilter(p, filter),
    );

    for (const project of filteredProjects) {
      if (project.status === "realization") {
        realization += 1;
      }

      const details = allProjectDetails[project.id];
      if (!details) continue;

      for (const cat of details.categories ?? []) {
        categoriesTotal += 1;
        if (cat.status === "open") openCategories += 1;

        const bids = details.bids?.[cat.id] ?? [];
        let hasSodWinner = false;
        let hasContracted = false;

        for (const bid of bids) {
          if (bid.status === "offer" || bid.status === "sent") offersReceived += 1;
          if (bid.status === "shortlist") evaluation += 1;
          if (bid.status === "sod") {
            hasSodWinner = true;
            if (bid.contracted) {
              hasContracted = true;
              awaitingSignature += 1;
            } else {
              contractDraft += 1;
            }
          }
        }

        if (hasContracted) signedCount += 1;

        const createdAt = cat.createdAt ? new Date(cat.createdAt) : null;
        if (createdAt && (hasSodWinner || cat.status === "sod" || cat.status === "closed")) {
          const days = Math.max(0, Math.round((now.getTime() - createdAt.getTime()) / MS_PER_DAY));
          leadDaysSum += days;
          leadDaysCount += 1;
          const entry: CatTiming = { label: cat.title || "—", days };
          if (!fastest || days < fastest.days) fastest = entry;
          if (!slowest || days > slowest.days) slowest = entry;
        }

        if (
          createdAt &&
          cat.status !== "sod" &&
          cat.status !== "closed" &&
          !hasContracted &&
          now.getTime() - createdAt.getTime() > 14 * MS_PER_DAY
        ) {
          breachCount += 1;
          if (!firstBreachLabel) {
            const projectShort = project.name?.split(" ")[0] ?? "";
            firstBreachLabel = projectShort
              ? `${cat.title} ${projectShort}`
              : cat.title || "—";
          }
        }
      }
    }

    const stages: FunnelStage[] = [
      {
        key: "tender-plan",
        label: "Tender plan",
        subtext: `${categoriesTotal} ${pluralize(categoriesTotal, "kategorie", "kategorie", "kategorií")}`,
        count: categoriesTotal,
        tone: "purple",
      },
      {
        key: "poptavka",
        label: "Poptávka",
        subtext: `${openCategories} ${pluralize(openCategories, "otevřená", "otevřené", "otevřených")}`,
        count: openCategories,
        tone: "blue",
      },
      {
        key: "offers",
        label: "Nabídky přijaty",
        subtext: `${offersReceived} ke zpracování`,
        count: offersReceived,
        tone: "blue",
      },
      {
        key: "evaluation",
        label: "Vyhodnocení",
        subtext: `${evaluation} ${pluralize(evaluation, "srovnání", "srovnání", "srovnání")}`,
        count: evaluation,
        tone: "amber",
      },
      {
        key: "contract-draft",
        label: "Smlouva draft",
        subtext: `${contractDraft} v přípravě`,
        count: contractDraft,
        tone: "green",
      },
      {
        key: "signature",
        label: "Podpis",
        subtext: `${awaitingSignature} ${pluralize(awaitingSignature, "čeká", "čekají", "čeká")}`,
        count: awaitingSignature,
        tone: "green",
      },
      {
        key: "realization",
        label: "Realizace",
        subtext: `${realization} v běhu`,
        count: realization,
        tone: "green",
      },
    ];

    const successPct = categoriesTotal > 0 ? Math.round((signedCount / categoriesTotal) * 100) : 0;
    const avgLeadDays = leadDaysCount > 0 ? Math.round(leadDaysSum / leadDaysCount) : null;

    return {
      stages,
      snapshotLabel: formatSnapshot(now),
      successPct,
      avgLeadDays,
      fastestCategory: fastest,
      slowestCategory: slowest,
      breaching14d: { count: breachCount, firstLabel: firstBreachLabel },
    };
  }, [projects, allProjectDetails, filter]);
};
