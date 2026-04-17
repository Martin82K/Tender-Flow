import { useMemo } from "react";
import { useAppData } from "@/hooks/useAppData";
import { useUI } from "@/context/UIContext";
import type { Signal, Severity, TimelineDay } from "@features/dashboard/model/signal";
import { SEVERITY_ORDER } from "@features/dashboard/model/severity";
import { buildDeadlineSignals } from "@features/dashboard/model/rules/deadlineSoon";
import { buildNoBidsSignals } from "@features/dashboard/model/rules/demandWithoutBids";
import { buildTenderEndingSignals } from "@features/dashboard/model/rules/tenderEndingNoWinner";
import { buildTimeline } from "@features/dashboard/model/timeline";

export interface CommandCenterSignalsResult {
  signals: Signal[];
  timeline: TimelineDay[];
  counts: Record<Severity, number>;
  isLoading: boolean;
}

export function useCommandCenterSignals(): CommandCenterSignalsResult {
  const { showUiModal } = useUI();
  const { state } = useAppData(showUiModal);

  const { projects, allProjectDetails, isDataLoading } = state;

  return useMemo<CommandCenterSignalsResult>(() => {
    const today = new Date();
    const activeProjects = projects.filter((p) => p.status !== "archived");

    const collected: Signal[] = [
      ...buildDeadlineSignals(activeProjects, allProjectDetails, today),
      ...buildNoBidsSignals(activeProjects, allProjectDetails, today),
      ...buildTenderEndingSignals(activeProjects, allProjectDetails, today),
    ];

    const signals = collected.slice().sort((a, b) => {
      const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sevDiff !== 0) return sevDiff;
      const aDays = a.daysUntilDue ?? Number.POSITIVE_INFINITY;
      const bDays = b.daysUntilDue ?? Number.POSITIVE_INFINITY;
      return aDays - bDays;
    });

    const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0 };
    for (const s of signals) counts[s.severity] += 1;

    const timeline = buildTimeline(signals, today, 30);

    return { signals, timeline, counts, isLoading: isDataLoading };
  }, [projects, allProjectDetails, isDataLoading]);
}
