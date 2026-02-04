import { describe, it, expect } from "vitest";
import { buildOverviewChatContext } from "../utils/overviewChat";
import type { OverviewAnalytics } from "../utils/overviewAnalytics";

describe("buildOverviewChatContext", () => {
  it("includes totals and top suppliers", () => {
    const analytics: OverviewAnalytics = {
      suppliers: [
        {
          id: "s1",
          name: "Alfa",
          offerCount: 4,
          sodCount: 2,
          successRate: 0.5,
          totalAwardedValue: 100000,
          categories: [],
        },
      ],
      categoryProfit: [
        {
          id: "c1",
          projectId: "p1",
          projectName: "Projekt A",
          label: "Elektro",
          revenue: 120000,
          cost: 90000,
          profit: 30000,
          margin: 25,
          offerCount: 2,
        },
      ],
      yearTrends: [
        { year: 2025, awardedValue: 100000, sodCount: 1, offerCount: 2, categoryCount: 1 },
      ],
      totals: {
        offerCount: 2,
        sodCount: 1,
        awardedValue: 100000,
        categoryCount: 1,
        projectCount: 1,
      },
    };

    const context = buildOverviewChatContext(analytics, "Všechny stavby");
    expect(context).toContain("Celkový objem oceněných zakázek");
    expect(context).toContain("Alfa");
    expect(context).toContain("Projekt A / Elektro");
    expect(context).toContain("2025");
  });
});
