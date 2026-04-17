import { describe, it, expect } from "vitest";
import type { Project, ProjectDetails, DemandCategory, Bid } from "@/types";
import { buildTenderEndingSignals } from "@features/dashboard/model/rules/tenderEndingNoWinner";

const TODAY = new Date("2026-04-17T12:00:00Z");

function isoAtOffset(days: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    name: "Projekt B",
    location: "Brno",
    status: "tender",
    ...overrides,
  };
}

function makeCategory(overrides: Partial<DemandCategory> = {}): DemandCategory {
  return {
    id: "c1",
    title: "Elektro",
    budget: "",
    sodBudget: 0,
    planBudget: 0,
    status: "negotiating",
    subcontractorCount: 2,
    description: "",
    ...overrides,
  };
}

function makeDetails(categories: DemandCategory[], bids?: Record<string, Bid[]>): ProjectDetails {
  return {
    title: "Projekt B",
    location: "Brno",
    finishDate: "",
    siteManager: "",
    categories,
    bids,
  };
}

function makeBid(overrides: Partial<Bid> = {}): Bid {
  return {
    id: "b1",
    subcontractorId: "s1",
    companyName: "ACME",
    contactPerson: "Jan",
    status: "contacted",
    ...overrides,
  };
}

describe("buildTenderEndingSignals", () => {
  it("emits critical signal when realization starts in <=14 days without a winner", () => {
    const project = makeProject();
    const category = makeCategory({ realizationStart: isoAtOffset(7) });
    const details = { p1: makeDetails([category], { c1: [makeBid()] }) };

    const signals = buildTenderEndingSignals([project], details, TODAY);
    expect(signals).toHaveLength(1);
    expect(signals[0].severity).toBe("critical");
    expect(signals[0].kind).toBe("tender_ending_no_winner");
    expect(signals[0].daysUntilDue).toBe(7);
    expect(signals[0].title).toContain("za 7 d");
    expect(signals[0].description).toContain("1 nabídek");
  });

  it("emits signal at boundary 0 days", () => {
    const project = makeProject();
    const category = makeCategory({ realizationStart: isoAtOffset(0) });
    const details = { p1: makeDetails([category]) };
    const signals = buildTenderEndingSignals([project], details, TODAY);
    expect(signals).toHaveLength(1);
    expect(signals[0].daysUntilDue).toBe(0);
  });

  it("does not emit when realization already started (negative days)", () => {
    const project = makeProject();
    const category = makeCategory({ realizationStart: isoAtOffset(-1) });
    const details = { p1: makeDetails([category]) };
    expect(buildTenderEndingSignals([project], details, TODAY)).toHaveLength(0);
  });

  it("does not emit when realization is more than 14 days away", () => {
    const project = makeProject();
    const category = makeCategory({ realizationStart: isoAtOffset(15) });
    const details = { p1: makeDetails([category]) };
    expect(buildTenderEndingSignals([project], details, TODAY)).toHaveLength(0);
  });

  it("does not emit when a bid has status 'sod'", () => {
    const project = makeProject();
    const category = makeCategory({ realizationStart: isoAtOffset(5) });
    const details = {
      p1: makeDetails([category], {
        c1: [makeBid({ status: "contacted" }), makeBid({ id: "b2", status: "sod" })],
      }),
    };
    expect(buildTenderEndingSignals([project], details, TODAY)).toHaveLength(0);
  });

  it("skips when realizationStart missing", () => {
    const project = makeProject();
    const category = makeCategory({ realizationStart: undefined });
    const details = { p1: makeDetails([category]) };
    expect(buildTenderEndingSignals([project], details, TODAY)).toHaveLength(0);
  });

  it("skips sod and closed categories", () => {
    const project = makeProject();
    const details = {
      p1: makeDetails([
        makeCategory({ id: "c-sod", status: "sod", realizationStart: isoAtOffset(3) }),
        makeCategory({ id: "c-closed", status: "closed", realizationStart: isoAtOffset(3) }),
      ]),
    };
    expect(buildTenderEndingSignals([project], details, TODAY)).toHaveLength(0);
  });
});
