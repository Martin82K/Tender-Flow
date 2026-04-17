import { describe, it, expect } from "vitest";
import type { Project, ProjectDetails, DemandCategory } from "@/types";
import { buildDeadlineSignals } from "@features/dashboard/model/rules/deadlineSoon";

const TODAY = new Date("2026-04-17T12:00:00Z");

function isoAtOffset(days: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    name: "Projekt A",
    location: "Praha",
    status: "tender",
    ...overrides,
  };
}

function makeCategory(overrides: Partial<DemandCategory> = {}): DemandCategory {
  return {
    id: "c1",
    title: "Zemní práce",
    budget: "",
    sodBudget: 0,
    planBudget: 0,
    status: "open",
    subcontractorCount: 3,
    description: "",
    ...overrides,
  };
}

function makeDetails(categories: DemandCategory[]): ProjectDetails {
  return {
    title: "Projekt A",
    location: "Praha",
    finishDate: "",
    siteManager: "",
    categories,
  };
}

describe("buildDeadlineSignals", () => {
  it.each([
    { offset: -1, severity: "critical", kind: "deadline_overdue" },
    { offset: 0, severity: "critical", kind: "deadline_soon" },
    { offset: 1, severity: "critical", kind: "deadline_soon" },
    { offset: 2, severity: "critical", kind: "deadline_soon" },
    { offset: 3, severity: "warning", kind: "deadline_soon" },
    { offset: 7, severity: "warning", kind: "deadline_soon" },
  ])("produces $severity/$kind signal at offset $offset", ({ offset, severity, kind }) => {
    const project = makeProject();
    const category = makeCategory({ deadline: isoAtOffset(offset) });
    const details = { p1: makeDetails([category]) };

    const signals = buildDeadlineSignals([project], details, TODAY);
    expect(signals).toHaveLength(1);
    expect(signals[0].severity).toBe(severity);
    expect(signals[0].kind).toBe(kind);
    expect(signals[0].daysUntilDue).toBe(offset);
    expect(signals[0].actionUrl).toContain("/project/p1");
    expect(signals[0].actionUrl).toContain("categoryId=c1");
  });

  it("skips categories with deadline more than 7 days away", () => {
    const project = makeProject();
    const category = makeCategory({ deadline: isoAtOffset(30) });
    const details = { p1: makeDetails([category]) };

    const signals = buildDeadlineSignals([project], details, TODAY);
    expect(signals).toHaveLength(0);
  });

  it("skips sod and closed categories", () => {
    const project = makeProject();
    const details = {
      p1: makeDetails([
        makeCategory({ id: "c-sod", status: "sod", deadline: isoAtOffset(1) }),
        makeCategory({ id: "c-closed", status: "closed", deadline: isoAtOffset(1) }),
        makeCategory({ id: "c-open", status: "open", deadline: isoAtOffset(1) }),
      ]),
    };

    const signals = buildDeadlineSignals([project], details, TODAY);
    expect(signals).toHaveLength(1);
    expect(signals[0].categoryId).toBe("c-open");
  });

  it("skips archived projects", () => {
    const project = makeProject({ status: "archived" });
    const details = { p1: makeDetails([makeCategory({ deadline: isoAtOffset(1) })]) };
    expect(buildDeadlineSignals([project], details, TODAY)).toHaveLength(0);
  });

  it("skips categories without deadline", () => {
    const project = makeProject();
    const details = { p1: makeDetails([makeCategory({ deadline: undefined })]) };
    expect(buildDeadlineSignals([project], details, TODAY)).toHaveLength(0);
  });

  it("includes overdue days in title and description", () => {
    const project = makeProject();
    const category = makeCategory({ deadline: isoAtOffset(-3), subcontractorCount: 4 });
    const details = { p1: makeDetails([category]) };

    const [signal] = buildDeadlineSignals([project], details, TODAY);
    expect(signal.title).toContain("termín po splatnosti (3 d)");
    expect(signal.description).toContain("4 dodavatelů");
  });
});
