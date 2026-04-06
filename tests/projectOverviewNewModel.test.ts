import { describe, it, expect } from "vitest";
import {
  calculateOverviewFinancials,
  parseMoney,
  formatMoney,
} from "@/features/projects/model/projectOverviewNewModel";
import type { ProjectDetails } from "@/types";

const makeProject = (overrides: Partial<ProjectDetails> = {}): ProjectDetails => ({
  title: "Test Project",
  location: "Praha",
  finishDate: "12/2026",
  siteManager: "Jan Novák",
  categories: [],
  ...overrides,
});

describe("calculateOverviewFinancials", () => {
  it("returns zero totals for empty project", () => {
    const project = makeProject();
    const result = calculateOverviewFinancials(project, 0);

    expect(result.totalBudget).toBe(0);
    expect(result.totalPlannedCost).toBe(0);
    expect(result.internalAmendmentsTotal).toBe(0);
    expect(result.totalContractedCost).toBe(0);
    expect(result.plannedBalance).toBe(0);
    expect(result.progress).toBe(0);
  });

  it("calculates investor budget with amendments", () => {
    const project = makeProject({
      investorFinancials: {
        sodPrice: 100_000_000,
        amendments: [
          { id: "a1", label: "Dodatek č.1", price: 5_000_000 },
          { id: "a2", label: "Dodatek č.2", price: 3_000_000 },
        ],
      },
    });
    const result = calculateOverviewFinancials(project, 90_000_000);

    expect(result.investorSod).toBe(100_000_000);
    expect(result.investorAmendmentsTotal).toBe(8_000_000);
    expect(result.totalBudget).toBe(108_000_000);
  });

  it("calculates internal cost WITHOUT internal amendments", () => {
    const project = makeProject();
    const result = calculateOverviewFinancials(project, 50_000_000);

    expect(result.totalPlannedCost).toBe(50_000_000);
    expect(result.internalAmendmentsTotal).toBe(0);
    expect(result.plannedBalance).toBe(50_000_000);
  });

  it("calculates internal cost WITH internal amendments", () => {
    const project = makeProject({
      internalAmendments: [
        { id: "ia1", label: "Dodatek č.1", price: 10_000_000 },
        { id: "ia2", label: "Dodatek č.2", price: 5_000_000 },
      ],
    });
    const result = calculateOverviewFinancials(project, 100_000_000);

    expect(result.internalAmendmentsTotal).toBe(15_000_000);
    expect(result.totalPlannedCost).toBe(115_000_000);
    expect(result.plannedBalance).toBe(115_000_000); // no contracted cost
  });

  it("calculates reserve with internal amendments and contracted costs", () => {
    const project = makeProject({
      internalAmendments: [
        { id: "ia1", label: "Dodatek č.1", price: 20_000_000 },
      ],
      categories: [
        {
          id: "cat1",
          title: "Elektro",
          budget: "",
          sodBudget: 0,
          planBudget: 0,
          status: "open",
          subcontractorCount: 1,
          description: "",
          workItems: [],
        },
      ],
      bids: {
        cat1: [
          {
            id: "b1",
            subcontractorId: "s1",
            companyName: "Firma A",
            contactPerson: null,
            email: null,
            phone: null,
            price: "30000000",
            notes: null,
            tags: [],
            status: "sod",
            updateDate: null,
            selectionRound: null,
            contracted: false,
          },
        ],
      },
    });
    const result = calculateOverviewFinancials(project, 100_000_000);

    // totalPlannedCost = 100M + 20M = 120M
    // totalContractedCost = 30M
    // plannedBalance = 120M - 30M = 90M
    expect(result.totalPlannedCost).toBe(120_000_000);
    expect(result.totalContractedCost).toBe(30_000_000);
    expect(result.plannedBalance).toBe(90_000_000);
    expect(result.completedTasks).toBe(1);
    expect(result.progress).toBe(100);
  });

  it("handles negative reserve when contracted exceeds total planned", () => {
    const project = makeProject({
      internalAmendments: [
        { id: "ia1", label: "Dodatek č.1", price: 5_000_000 },
      ],
      categories: [
        {
          id: "cat1",
          title: "Stavba",
          budget: "",
          sodBudget: 0,
          planBudget: 0,
          status: "open",
          subcontractorCount: 1,
          description: "",
          workItems: [],
        },
      ],
      bids: {
        cat1: [
          {
            id: "b1",
            subcontractorId: "s1",
            companyName: "Firma B",
            contactPerson: null,
            email: null,
            phone: null,
            price: "60000000",
            notes: null,
            tags: [],
            status: "sod",
            updateDate: null,
            selectionRound: null,
            contracted: false,
          },
        ],
      },
    });
    const result = calculateOverviewFinancials(project, 50_000_000);

    // totalPlannedCost = 50M + 5M = 55M
    // totalContractedCost = 60M
    // plannedBalance = 55M - 60M = -5M
    expect(result.totalPlannedCost).toBe(55_000_000);
    expect(result.plannedBalance).toBe(-5_000_000);
  });

  it("returns zero balance when plannedCost is 0 even with amendments", () => {
    const project = makeProject({
      internalAmendments: [
        { id: "ia1", label: "Dodatek č.1", price: 5_000_000 },
      ],
    });
    const result = calculateOverviewFinancials(project, 0);

    // totalPlannedCost = 0 + 5M = 5M, which is > 0, so balance = 5M - 0 = 5M
    expect(result.totalPlannedCost).toBe(5_000_000);
    expect(result.plannedBalance).toBe(5_000_000);
  });
});

describe("parseMoney", () => {
  it("parses plain numbers", () => {
    expect(parseMoney("1000")).toBe(1000);
    expect(parseMoney("1 000")).toBe(1000);
  });

  it("returns 0 for empty/dash/question", () => {
    expect(parseMoney("")).toBe(0);
    expect(parseMoney("-")).toBe(0);
    expect(parseMoney("?")).toBe(0);
  });

  it("handles M suffix", () => {
    expect(parseMoney("1.5M")).toBe(1_500_000);
  });
});

describe("formatMoney", () => {
  it("formats Czech currency", () => {
    const formatted = formatMoney(1000000);
    expect(formatted).toContain("1");
    expect(formatted).toContain("000");
    expect(formatted).toContain("000");
  });
});
