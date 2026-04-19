import { useMemo } from "react";
import { useAppData } from "@/hooks/useAppData";
import { useUI } from "@/context/UIContext";
import type { CommandCenterFilterState } from "@features/command-center/types";
import { matchesFilter } from "./filterUtils";

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  tone: "blue" | "purple" | "amber" | "green" | "red";
}

export const usePipelineFunnelData = (filter: CommandCenterFilterState): FunnelStage[] => {
  const { showUiModal } = useUI();
  const { state } = useAppData(showUiModal);
  const { projects, allProjectDetails } = state;

  return useMemo(() => {
    const counts = {
      new: 0,
      contacted: 0,
      offer: 0,
      shortlist: 0,
      sod: 0,
    };

    for (const project of projects) {
      if (project.status === "archived") continue;
      if (!matchesFilter(project, filter)) continue;
      const details = allProjectDetails[project.id];
      if (!details) continue;

      for (const cat of details.categories ?? []) {
        if (cat.status === "open") counts.new += 1;
        const bids = details.bids?.[cat.id] ?? [];
        for (const bid of bids) {
          if (bid.status === "contacted" || bid.status === "sent") counts.contacted += 1;
          if (bid.status === "offer") counts.offer += 1;
          if (bid.status === "shortlist") counts.shortlist += 1;
          if (bid.status === "sod") counts.sod += 1;
        }
      }
    }

    return [
      { key: "new", label: "Nové", count: counts.new, tone: "blue" },
      { key: "contacted", label: "Osloveni", count: counts.contacted, tone: "purple" },
      { key: "offer", label: "Nabídky", count: counts.offer, tone: "amber" },
      { key: "shortlist", label: "Shortlist", count: counts.shortlist, tone: "green" },
      { key: "sod", label: "SoD", count: counts.sod, tone: "green" },
    ];
  }, [projects, allProjectDetails, filter]);
};
