import { describe, it, expect } from "vitest";
import { buildOverviewAnalytics, parseMoneyValue } from "../utils/overviewAnalytics";
import type { Project, ProjectDetails } from "../types";

describe("overviewAnalytics", () => {
  it("parses money values with suffixes", () => {
    expect(parseMoneyValue("1 200 000 Kč")).toBe(1200000);
    expect(parseMoneyValue("1.5M")).toBe(1500000);
    expect(parseMoneyValue("250k")).toBe(250000);
  });

  it("builds supplier stats, category profit and trends", () => {
    const projects: Project[] = [
      { id: "p1", name: "Projekt A", location: "Praha", status: "tender" },
      { id: "p2", name: "Projekt B", location: "Brno", status: "realization" },
    ];

    const projectDetails: Record<string, ProjectDetails> = {
      p1: {
        title: "Projekt A",
        location: "Praha",
        finishDate: "2025-02-10",
        siteManager: "Novak",
        categories: [
          {
            id: "c1",
            title: "Elektro",
            budget: "100 000 Kč",
            sodBudget: 100000,
            planBudget: 95000,
            status: "sod",
            subcontractorCount: 2,
            description: "Elektro práce",
          },
        ],
        bids: {
          c1: [
            {
              id: "b1",
              subcontractorId: "s1",
              companyName: "Alfa",
              contactPerson: "A",
              status: "sod",
              price: "90 000 Kč",
              updateDate: "2025-01-02",
            },
            {
              id: "b2",
              subcontractorId: "s2",
              companyName: "Beta",
              contactPerson: "B",
              status: "offer",
              price: "95 000 Kč",
              updateDate: "2025-01-03",
            },
          ],
        },
      },
      p2: {
        title: "Projekt B",
        location: "Brno",
        finishDate: "2026-03-01",
        siteManager: "Svoboda",
        categories: [
          {
            id: "c2",
            title: "Střecha",
            budget: "200 000 Kč",
            sodBudget: 200000,
            planBudget: 190000,
            status: "open",
            subcontractorCount: 1,
            description: "Střecha",
          },
        ],
        bids: {
          c2: [
            {
              id: "b3",
              subcontractorId: "s1",
              companyName: "Alfa",
              contactPerson: "A",
              status: "offer",
              price: "210 000 Kč",
              updateDate: "2026-01-05",
            },
          ],
        },
      },
    };

    const analytics = buildOverviewAnalytics(projects, projectDetails);

    expect(analytics.suppliers.length).toBe(2);
    const alfa = analytics.suppliers.find((s) => s.id === "s1");
    expect(alfa?.offerCount).toBe(2);
    expect(alfa?.sodCount).toBe(1);
    expect(alfa?.totalAwardedValue).toBe(90000);
    expect(alfa?.lastAwardedLabel).toBe("Projekt A / Elektro");

    expect(analytics.categoryProfit.length).toBe(2);
    const elektro = analytics.categoryProfit.find((c) => c.id === "c1");
    expect(elektro?.profit).toBe(10000);

    const trend2025 = analytics.yearTrends.find((t) => t.year === 2025);
    expect(trend2025?.sodCount).toBe(1);
    expect(trend2025?.awardedValue).toBe(90000);
    expect(analytics.totalsByStatus.tender.offerCount).toBe(2);
    expect(analytics.totalsByStatus.realization.offerCount).toBe(1);
  });

  it("handles missing project details without crashing", () => {
    const projects: Project[] = [
      { id: "p1", name: "Projekt A", location: "Praha", status: "tender" },
      { id: "p2", name: "Projekt B", location: "Brno", status: "realization" },
    ];

    const projectDetails: Record<string, ProjectDetails> = {
      p1: {
        title: "Projekt A",
        location: "Praha",
        finishDate: "2025-02-10",
        siteManager: "Novak",
        categories: [],
      },
    };

    const analytics = buildOverviewAnalytics(projects, projectDetails);
    expect(analytics.totals.projectCount).toBe(2);
    expect(analytics.totals.categoryCount).toBe(0);
  });
});
