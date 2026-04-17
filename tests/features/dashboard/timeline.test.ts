import { describe, it, expect } from "vitest";
import type { Signal } from "@features/dashboard/model/signal";
import { buildTimeline } from "@features/dashboard/model/timeline";

const TODAY = new Date("2026-04-17T12:00:00Z");

function isoAtOffset(days: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function makeSignal(overrides: Partial<Signal> & { id: string }): Signal {
  return {
    id: overrides.id,
    severity: "warning",
    kind: "deadline_soon",
    projectId: "p1",
    projectName: "P1",
    title: "Signal " + overrides.id,
    description: "",
    actionUrl: "/x",
    ...overrides,
  };
}

describe("buildTimeline", () => {
  it("returns a 30-day window starting today by default", () => {
    const timeline = buildTimeline([], TODAY);
    expect(timeline).toHaveLength(30);
    expect(timeline[0].date).toBe(isoAtOffset(0));
    expect(timeline[29].date).toBe(isoAtOffset(29));
    expect(timeline.every((d) => d.items.length === 0)).toBe(true);
  });

  it("supports a custom window length", () => {
    const timeline = buildTimeline([], TODAY, 7);
    expect(timeline).toHaveLength(7);
  });

  it("places signal on correct day by dueDate", () => {
    const signal = makeSignal({ id: "s1", dueDate: isoAtOffset(5), daysUntilDue: 5 });
    const timeline = buildTimeline([signal], TODAY);
    expect(timeline[5].items).toHaveLength(1);
    expect(timeline[5].items[0].signalId).toBe("s1");
    expect(timeline[5].items[0].label).toBe("Signal s1");
  });

  it("excludes overdue signals (daysUntilDue < 0)", () => {
    const signal = makeSignal({
      id: "overdue",
      dueDate: isoAtOffset(-3),
      daysUntilDue: -3,
      kind: "deadline_overdue",
      severity: "critical",
    });
    const timeline = buildTimeline([signal], TODAY);
    const total = timeline.reduce((acc, d) => acc + d.items.length, 0);
    expect(total).toBe(0);
  });

  it("excludes signals outside the window", () => {
    const signal = makeSignal({ id: "far", dueDate: isoAtOffset(60), daysUntilDue: 60 });
    const timeline = buildTimeline([signal], TODAY);
    const total = timeline.reduce((acc, d) => acc + d.items.length, 0);
    expect(total).toBe(0);
  });

  it("skips signals without dueDate", () => {
    const signal = makeSignal({ id: "no-due" });
    const timeline = buildTimeline([signal], TODAY);
    const total = timeline.reduce((acc, d) => acc + d.items.length, 0);
    expect(total).toBe(0);
  });

  it("groups multiple signals on the same day", () => {
    const signals = [
      makeSignal({ id: "a", dueDate: isoAtOffset(3), daysUntilDue: 3 }),
      makeSignal({
        id: "b",
        dueDate: isoAtOffset(3),
        daysUntilDue: 3,
        severity: "critical",
        kind: "tender_ending_no_winner",
      }),
    ];
    const timeline = buildTimeline(signals, TODAY);
    expect(timeline[3].items).toHaveLength(2);
    expect(timeline[3].items.map((i) => i.signalId).sort()).toEqual(["a", "b"]);
  });
});
