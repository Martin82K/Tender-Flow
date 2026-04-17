import { describe, it, expect } from "vitest";
import type { Project, ProjectDetails, DemandCategory, Bid } from "@/types";
import { buildNoBidsSignals } from "@features/dashboard/model/rules/demandWithoutBids";

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
    title: "Omítky",
    budget: "",
    sodBudget: 0,
    planBudget: 0,
    status: "open",
    subcontractorCount: 3,
    description: "",
    ...overrides,
  };
}

function makeDetails(categories: DemandCategory[], bids?: Record<string, Bid[]>): ProjectDetails {
  return {
    title: "Projekt A",
    location: "Praha",
    finishDate: "",
    siteManager: "",
    categories,
    bids,
  };
}

describe("buildNoBidsSignals", () => {
  it("emits signal when category is open, 14+ days old, and has no bids", () => {
    const project = makeProject();
    const category = makeCategory({ createdAt: isoAtOffset(-15) });
    const details = { p1: makeDetails([category]) };

    const signals = buildNoBidsSignals([project], details, TODAY);
    expect(signals).toHaveLength(1);
    expect(signals[0].severity).toBe("warning");
    expect(signals[0].kind).toBe("no_bids_14d");
    expect(signals[0].title).toContain("14+ dní bez nabídek");
    expect(signals[0].description).toContain("15 dny");
    expect(signals[0].actionUrl).toContain("categoryId=c1");
  });

  it("does not emit at 13 days old", () => {
    const project = makeProject();
    const category = makeCategory({ createdAt: isoAtOffset(-13) });
    const details = { p1: makeDetails([category]) };
    expect(buildNoBidsSignals([project], details, TODAY)).toHaveLength(0);
  });

  it("emits exactly at 14 days old", () => {
    const project = makeProject();
    const category = makeCategory({ createdAt: isoAtOffset(-14) });
    const details = { p1: makeDetails([category]) };
    expect(buildNoBidsSignals([project], details, TODAY)).toHaveLength(1);
  });

  it("does not emit when createdAt is missing", () => {
    const project = makeProject();
    const category = makeCategory({ createdAt: undefined });
    const details = { p1: makeDetails([category]) };
    expect(buildNoBidsSignals([project], details, TODAY)).toHaveLength(0);
  });

  it("does not emit when bids already exist", () => {
    const project = makeProject();
    const category = makeCategory({ createdAt: isoAtOffset(-20) });
    const details = {
      p1: makeDetails([category], {
        c1: [
          {
            id: "b1",
            subcontractorId: "s1",
            companyName: "ACME",
            contactPerson: "Jan",
            status: "contacted",
          },
        ],
      }),
    };
    expect(buildNoBidsSignals([project], details, TODAY)).toHaveLength(0);
  });

  it("skips non-open categories", () => {
    const project = makeProject();
    const details = {
      p1: makeDetails([
        makeCategory({ id: "c-neg", status: "negotiating", createdAt: isoAtOffset(-20) }),
        makeCategory({ id: "c-sod", status: "sod", createdAt: isoAtOffset(-20) }),
      ]),
    };
    expect(buildNoBidsSignals([project], details, TODAY)).toHaveLength(0);
  });

  it("populates dueDate and daysUntilDue when deadline exists", () => {
    const project = makeProject();
    const category = makeCategory({
      createdAt: isoAtOffset(-20),
      deadline: isoAtOffset(5),
    });
    const details = { p1: makeDetails([category]) };

    const [signal] = buildNoBidsSignals([project], details, TODAY);
    expect(signal.dueDate).toBe(isoAtOffset(5));
    expect(signal.daysUntilDue).toBe(5);
  });
});
