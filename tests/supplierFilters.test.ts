import { describe, it, expect } from "vitest";
import { filterSuppliers } from "../utils/supplierFilters";

describe("filterSuppliers", () => {
  const suppliers = [
    {
      id: "s1",
      name: "Alfa",
      offerCount: 1,
      sodCount: 1,
      successRate: 1,
      totalAwardedValue: 1000,
      categories: [],
      contact: { specialization: ["Elektro", "TZB"] },
    },
    {
      id: "s2",
      name: "Beta",
      offerCount: 1,
      sodCount: 0,
      successRate: 0,
      totalAwardedValue: 0,
      categories: [],
      contact: { specialization: ["Sádrokarton"] },
    },
  ];

  it("filters by query", () => {
    const result = filterSuppliers(suppliers as any, { query: "alf", specialization: "" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alfa");
  });

  it("filters by specialization", () => {
    const result = filterSuppliers(suppliers as any, { query: "", specialization: "sádro" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Beta");
  });
});
