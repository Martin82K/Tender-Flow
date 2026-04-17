import React, { useCallback } from "react";
import type { Signal } from "@features/dashboard/model/signal";
import { useCommandCenterSignals } from "@features/dashboard/hooks/useCommandCenterSignals";
import { AlertsPanel } from "@features/dashboard/ui/AlertsPanel";
import { TimelineStrip } from "@features/dashboard/ui/TimelineStrip";
import { CommandCenterSkeleton } from "@features/dashboard/ui/CommandCenterSkeleton";
import { navigate } from "@shared/routing/router";

export const CommandCenter: React.FC = () => {
  const { signals, timeline, counts, isLoading } = useCommandCenterSignals();

  const handleSignalClick = useCallback((signal: Signal) => {
    if (signal.actionUrl) {
      navigate(signal.actionUrl);
    }
  }, []);

  const handleTimelineItemClick = useCallback(
    (signalId: string) => {
      const signal = signals.find((s) => s.id === signalId);
      if (!signal) return;

      const target = document.getElementById(signalId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.focus({ preventScroll: true });
      } else {
        handleSignalClick(signal);
      }
    },
    [signals, handleSignalClick]
  );

  if (isLoading && signals.length === 0) {
    return (
      <section className="space-y-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            Command Center
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Načítám signály…
          </p>
        </header>
        <CommandCenterSkeleton />
      </section>
    );
  }

  const summaryParts: string[] = [];
  if (counts.critical > 0) summaryParts.push(`${counts.critical} urgentní`);
  if (counts.warning > 0) summaryParts.push(`${counts.warning} vyžadují pozornost`);
  if (counts.info > 0) summaryParts.push(`${counts.info} info`);
  const summary =
    summaryParts.length > 0
      ? summaryParts.join(" · ")
      : "Žádné aktivní signály";

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          Command Center
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{summary}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <AlertsPanel signals={signals} onSignalClick={handleSignalClick} />
        </div>
        <div className="lg:col-span-2">
          <TimelineStrip
            timeline={timeline}
            onItemClick={handleTimelineItemClick}
          />
        </div>
      </div>
    </section>
  );
};
