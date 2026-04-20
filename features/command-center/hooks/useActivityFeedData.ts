import { useMemo } from "react";
import { useAppData } from "@/hooks/useAppData";
import { useUI } from "@/context/UIContext";
import type { CommandCenterFilterState } from "@features/command-center/types";
import { matchesFilter } from "./filterUtils";

export interface ActivityItem {
  id: string;
  tone: "blue" | "green" | "purple" | "amber";
  title: string;
  subtitle?: string;
  timestamp: number;
  timeLabel: string;
}

const formatRelativeTime = (ms: number): string => {
  const diff = Date.now() - ms;
  const minutes = Math.round(diff / (1000 * 60));
  if (minutes < 1) return "právě teď";
  if (minutes < 60) return `před ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `před ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `před ${days} d`;
  return new Date(ms).toLocaleDateString("cs-CZ");
};

export const useActivityFeedData = (filter: CommandCenterFilterState): ActivityItem[] => {
  const { showUiModal } = useUI();
  const { state } = useAppData(showUiModal);
  const { projects, allProjectDetails } = state;

  return useMemo(() => {
    const items: ActivityItem[] = [];

    for (const project of projects) {
      if (project.status === "archived") continue;
      if (!matchesFilter(project, filter)) continue;
      const details = allProjectDetails[project.id];
      if (!details) continue;

      for (const cat of details.categories ?? []) {
        if (cat.createdAt) {
          const ts = new Date(cat.createdAt).getTime();
          if (Number.isFinite(ts)) {
            items.push({
              id: `cat-created-${cat.id}`,
              tone: "blue",
              title: `Nová poptávka: ${cat.title}`,
              subtitle: project.name,
              timestamp: ts,
              timeLabel: formatRelativeTime(ts),
            });
          }
        }
        for (const doc of cat.documents ?? []) {
          const ts = new Date(doc.uploadedAt).getTime();
          if (Number.isFinite(ts)) {
            items.push({
              id: `doc-${doc.id}`,
              tone: "green",
              title: `Dokument: ${doc.name}`,
              subtitle: `${project.name} · ${cat.title}`,
              timestamp: ts,
              timeLabel: formatRelativeTime(ts),
            });
          }
        }
        const bids = details.bids?.[cat.id] ?? [];
        for (const bid of bids) {
          if (bid.status === "sod") {
            items.push({
              id: `sod-${bid.id}`,
              tone: "purple",
              title: `Vítěz: ${bid.companyName}`,
              subtitle: `${project.name} · ${cat.title}`,
              timestamp: Date.now(),
              timeLabel: "nedávno",
            });
          }
        }
      }
    }

    return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
  }, [projects, allProjectDetails, filter]);
};
