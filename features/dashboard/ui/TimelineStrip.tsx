import React from "react";
import type { Severity, TimelineDay } from "@features/dashboard/model/signal";
import {
  SEVERITY_DOT_CLASSES,
  SEVERITY_LABEL,
  SEVERITY_ORDER,
} from "@features/dashboard/model/severity";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/Card";

interface TimelineStripProps {
  timeline: TimelineDay[];
  onItemClick: (signalId: string) => void;
}

const WEEK_LABELS = ["Tento týden", "+1 týden", "+2", "+3", "+4"];

const pickDominantSeverity = (day: TimelineDay): Severity | null => {
  if (day.items.length === 0) return null;
  let best: Severity = day.items[0].severity;
  for (const item of day.items) {
    if (SEVERITY_ORDER[item.severity] < SEVERITY_ORDER[best]) {
      best = item.severity;
    }
  }
  return best;
};

const formatTooltip = (day: TimelineDay): string => {
  if (day.items.length === 0) return day.date;
  const first = day.items[0].label;
  const extra = day.items.length > 1 ? ` (+${day.items.length - 1} další)` : "";
  return `${day.date} · ${first}${extra}`;
};

export const TimelineStrip: React.FC<TimelineStripProps> = ({
  timeline,
  onItemClick,
}) => {
  const weeks: TimelineDay[][] = [];
  for (let i = 0; i < 5; i += 1) {
    weeks.push(timeline.slice(i * 7, i * 7 + 7));
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Nejbližších 30 dní</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {weeks.map((week, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {WEEK_LABELS[idx]}
              </span>
              <div className="flex gap-1.5">
                {week.map((day) => {
                  const severity = pickDominantSeverity(day);
                  const hasItems = day.items.length > 0;
                  const dotClass = severity
                    ? SEVERITY_DOT_CLASSES[severity]
                    : "bg-slate-200 dark:bg-slate-800";

                  const commonClass = `w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${dotClass} ${
                    hasItems ? "text-white cursor-pointer hover:scale-110 transition-transform" : "text-transparent"
                  }`;

                  if (hasItems) {
                    return (
                      <button
                        key={day.date}
                        type="button"
                        title={formatTooltip(day)}
                        onClick={() => onItemClick(day.items[0].signalId)}
                        className={commonClass}
                        aria-label={`${day.date}: ${day.items.length} signál(ů)`}
                      >
                        {day.items.length > 1 ? day.items.length : ""}
                      </button>
                    );
                  }

                  return (
                    <span
                      key={day.date}
                      title={day.date}
                      className={commonClass}
                      aria-hidden="true"
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          {(["critical", "warning", "info"] as Severity[]).map((sev) => (
            <span key={sev} className="inline-flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${SEVERITY_DOT_CLASSES[sev]}`}
              />
              {SEVERITY_LABEL[sev]}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
