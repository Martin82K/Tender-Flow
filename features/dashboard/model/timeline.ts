import type { Signal, TimelineDay, TimelineItem } from "@features/dashboard/model/signal";
import { addDays, dateDiffDays, formatIsoDate, toUtcStartOfDay } from "@features/dashboard/model/utils/dates";

export function buildTimeline(signals: Signal[], today: Date, days = 30): TimelineDay[] {
  const base = toUtcStartOfDay(today);
  if (!base) return [];

  const daysArr: TimelineDay[] = [];
  const indexByDate = new Map<string, TimelineDay>();

  for (let i = 0; i < days; i += 1) {
    const d = addDays(base, i);
    const iso = formatIsoDate(d);
    const entry: TimelineDay = { date: iso, items: [] };
    daysArr.push(entry);
    indexByDate.set(iso, entry);
  }

  for (const signal of signals) {
    if (!signal.dueDate) continue;
    if (typeof signal.daysUntilDue === "number" && signal.daysUntilDue < 0) continue;

    const diff = dateDiffDays(signal.dueDate, base);
    if (diff === null) continue;
    if (diff < 0 || diff >= days) continue;

    const targetDate = formatIsoDate(addDays(base, diff));
    const bucket = indexByDate.get(targetDate);
    if (!bucket) continue;

    const item: TimelineItem = {
      signalId: signal.id,
      kind: signal.kind,
      severity: signal.severity,
      projectId: signal.projectId,
      label: signal.title,
    };
    bucket.items.push(item);
  }

  return daysArr;
}
