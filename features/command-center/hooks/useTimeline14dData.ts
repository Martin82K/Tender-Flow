import { useMemo } from "react";
import { useAppData } from "@/hooks/useAppData";
import { useUI } from "@/context/UIContext";
import { buildAppUrl } from "@shared/routing/routeUtils";
import type { CommandCenterFilterState } from "@features/command-center/types";
import { matchesFilter } from "./filterUtils";

export interface TimelineDay {
  iso: string;
  label: string;
}

export interface TimelineEvent {
  id: string;
  tone: "red" | "amber" | "green" | "blue" | "purple";
  title: string;
  icon: string;
  actionUrl?: string;
}

export interface TimelineLane {
  projectId: string;
  projectName: string;
  byDate: Record<string, TimelineEvent[]>;
}

export interface TimelineData {
  days: TimelineDay[];
  lanes: TimelineLane[];
}

const toIsoDay = (d: Date) => d.toISOString().slice(0, 10);

const buildDays = (range: number): TimelineDay[] => {
  const days: TimelineDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < range; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    days.push({
      iso: toIsoDay(date),
      label: date.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" }),
    });
  }
  return days;
};

export const useTimeline14dData = (filter: CommandCenterFilterState): TimelineData => {
  const { showUiModal } = useUI();
  const { state } = useAppData(showUiModal);
  const { projects, allProjectDetails } = state;

  return useMemo(() => {
    const range = filter.rangeDays;
    const days = buildDays(range);
    const validIsoSet = new Set(days.map((d) => d.iso));
    const lanes: TimelineLane[] = [];

    for (const project of projects) {
      if (project.status === "archived") continue;
      if (!matchesFilter(project, filter)) continue;
      const details = allProjectDetails[project.id];
      if (!details) continue;

      const byDate: Record<string, TimelineEvent[]> = {};
      const push = (iso: string, evt: TimelineEvent) => {
        if (!validIsoSet.has(iso)) return;
        if (!byDate[iso]) byDate[iso] = [];
        byDate[iso].push(evt);
      };

      for (const cat of details.categories ?? []) {
        if (cat.deadline) {
          const iso = cat.deadline.slice(0, 10);
          push(iso, {
            id: `deadline-${cat.id}`,
            tone: "red",
            icon: "◆",
            title: `DDL nabídky: ${cat.title}`,
            actionUrl: buildAppUrl("project", {
              projectId: project.id,
              tab: "pipeline",
              categoryId: cat.id,
            }),
          });
        }
        if (cat.realizationStart) {
          const iso = cat.realizationStart.slice(0, 10);
          push(iso, {
            id: `realstart-${cat.id}`,
            tone: "blue",
            icon: "▶",
            title: `Začátek realizace: ${cat.title}`,
            actionUrl: buildAppUrl("project", {
              projectId: project.id,
              tab: "schedule",
            }),
          });
        }
        const bids = details.bids?.[cat.id] ?? [];
        for (const bid of bids) {
          if (bid.status === "sod" && !bid.contracted && cat.deadline) {
            const deadline = new Date(cat.deadline);
            deadline.setDate(deadline.getDate() + 3);
            push(toIsoDay(deadline), {
              id: `contract-${bid.id}`,
              tone: "purple",
              icon: "✎",
              title: `Podpis smlouvy: ${bid.companyName}`,
              actionUrl: buildAppUrl("project", {
                projectId: project.id,
                tab: "contracts",
              }),
            });
          }
        }
      }

      if (Object.keys(byDate).length > 0) {
        lanes.push({
          projectId: project.id,
          projectName: project.name,
          byDate,
        });
      }
    }

    return { days, lanes };
  }, [projects, allProjectDetails, filter]);
};
