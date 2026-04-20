import { describe, expect, it } from "vitest";
import {
  classifyTaskSeverity,
  mergeActionQueue,
} from "@features/tasks/model/actionQueueMerge";
import type { Task } from "@features/tasks/types";
import type { DerivedAction } from "@features/command-center/types";

const NOW = new Date("2026-04-20T10:00:00Z");

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  title: "Testovací úkol",
  completed: false,
  createdBy: "user-1",
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  ...overrides,
});

const makeDerived = (overrides: Partial<DerivedAction> = {}): DerivedAction => ({
  id: "d-1",
  severity: "info",
  title: "Derivovaná akce",
  projectId: "proj-1",
  ...overrides,
});

describe("classifyTaskSeverity", () => {
  it("overdue task → critical", () => {
    const t = makeTask({ dueAt: "2026-04-18T10:00:00Z" });
    expect(classifyTaskSeverity(t, NOW)).toBe("critical");
  });

  it("dnes + priority 1 → critical", () => {
    const t = makeTask({ dueAt: "2026-04-20T18:00:00Z", priority: 1 });
    expect(classifyTaskSeverity(t, NOW)).toBe("critical");
  });

  it("dnes bez priority → warning", () => {
    const t = makeTask({ dueAt: "2026-04-20T18:00:00Z" });
    expect(classifyTaskSeverity(t, NOW)).toBe("warning");
  });

  it("do 3 dnů + priority 2 → warning", () => {
    const t = makeTask({ dueAt: "2026-04-22T10:00:00Z", priority: 2 });
    expect(classifyTaskSeverity(t, NOW)).toBe("warning");
  });

  it("priority 1 bez dueAt → warning", () => {
    const t = makeTask({ priority: 1 });
    expect(classifyTaskSeverity(t, NOW)).toBe("warning");
  });

  it("vzdálený deadline bez priority → info", () => {
    const t = makeTask({ dueAt: "2026-05-15T10:00:00Z" });
    expect(classifyTaskSeverity(t, NOW)).toBe("info");
  });

  it("task bez dueAt a bez priority → info", () => {
    expect(classifyTaskSeverity(makeTask(), NOW)).toBe("info");
  });
});

describe("mergeActionQueue", () => {
  it("vyfiltruje dokončené tasky", () => {
    const result = mergeActionQueue({
      derivedActions: [],
      tasks: [
        makeTask({ id: "a", completed: true, completedAt: NOW.toISOString() }),
        makeTask({ id: "b" }),
      ],
      now: NOW,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("task:b");
  });

  it("seřadí podle severity — critical před warning před info", () => {
    const result = mergeActionQueue({
      derivedActions: [
        makeDerived({ id: "d-info", severity: "info" }),
        makeDerived({ id: "d-crit", severity: "critical" }),
        makeDerived({ id: "d-warn", severity: "warning" }),
      ],
      tasks: [],
      now: NOW,
    });
    expect(result.map((r) => r.id)).toEqual([
      "derived:d-crit",
      "derived:d-warn",
      "derived:d-info",
    ]);
  });

  it("mixuje derived akce a tasky a řadí společně", () => {
    const result = mergeActionQueue({
      derivedActions: [makeDerived({ id: "d-1", severity: "warning" })],
      tasks: [
        makeTask({ id: "overdue", dueAt: "2026-04-18T10:00:00Z" }),
        makeTask({ id: "ok", priority: 3 }),
      ],
      now: NOW,
    });
    expect(result[0].id).toBe("task:overdue"); // critical
    expect(result[1].id).toBe("derived:d-1"); // warning
    expect(result[2].id).toBe("task:ok"); // info
  });

  it("přiřadí projectName z mapy", () => {
    const result = mergeActionQueue({
      derivedActions: [],
      tasks: [makeTask({ projectId: "p-1" })],
      projectNames: { "p-1": "Karlín" },
      now: NOW,
    });
    expect(result[0].projectName).toBe("Karlín");
  });

  it("v rámci stejné severity a dueAt preferuje task s nižším číslem priority", () => {
    const sameDue = "2026-04-22T10:00:00Z";
    const result = mergeActionQueue({
      derivedActions: [],
      tasks: [
        makeTask({ id: "p2", dueAt: sameDue, priority: 2 }),
        makeTask({ id: "p1", dueAt: sameDue, priority: 1 }),
      ],
      now: NOW,
    });
    expect(result.map((r) => r.id)).toEqual(["task:p1", "task:p2"]);
  });
});
