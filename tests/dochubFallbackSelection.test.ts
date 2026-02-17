import { describe, expect, it } from "vitest";
import { collectFallbackSuppliers } from "../shared/dochub/fallbackSelection";
import type { Bid, DemandCategory } from "../types";

const categories: DemandCategory[] = [
  {
    id: "cat-1",
    title: "Zemni prace",
    budget: "0 Kč",
    sodBudget: 0,
    planBudget: 0,
    status: "open",
    subcontractorCount: 0,
    description: "",
  },
  {
    id: "cat-2",
    title: "VZT",
    budget: "0 Kč",
    sodBudget: 0,
    planBudget: 0,
    status: "open",
    subcontractorCount: 0,
    description: "",
  },
];

const bid = (overrides: Partial<Bid>): Bid =>
  ({
    id: "bid-default",
    subcontractorId: "sup-default",
    companyName: "Default s.r.o.",
    contactPerson: "Test",
    status: "contacted",
    ...overrides,
  }) as Bid;

describe("collectFallbackSuppliers", () => {
  it("includes only sent status and always excludes rejected", () => {
    const bidsByCategory = {
      "cat-1": [
        bid({ id: "b1", subcontractorId: "s1", companyName: "A", status: "contacted" }),
        bid({ id: "b2", subcontractorId: "s2", companyName: "B", status: "sent" }),
        bid({ id: "b4", subcontractorId: "s4", companyName: "D", status: "offer" }),
        bid({ id: "b3", subcontractorId: "s3", companyName: "C", status: "rejected" }),
      ],
    };

    const result = collectFallbackSuppliers({
      categories,
      bidsByCategory,
    });

    expect(result.categoriesForEnsure.map((c) => c.id)).toEqual(["cat-1", "cat-2"]);
    expect(result.suppliersByCategory["cat-1"]).toEqual([{ id: "s2", name: "B" }]);
    expect(result.suppliersByCategory["cat-1"].some((s) => s.id === "s3")).toBe(false);
  });

  it("deduplicates suppliers by subcontractorId within category", () => {
    const bidsByCategory = {
      "cat-1": [
        bid({ id: "b1", subcontractorId: "s1", companyName: "A", status: "sent" }),
        bid({ id: "b2", subcontractorId: "s1", companyName: "A Updated", status: "sent" }),
      ],
    };

    const result = collectFallbackSuppliers({
      categories,
      bidsByCategory,
    });

    expect(result.suppliersByCategory["cat-1"]).toEqual([{ id: "s1", name: "A" }]);
  });

  it("skips broken supplier entries with missing id or company name", () => {
    const bidsByCategory = {
      "cat-1": [
        bid({ id: "b1", subcontractorId: "", companyName: "A", status: "sent" }),
        bid({ id: "b2", subcontractorId: "s2", companyName: "", status: "sent" }),
        bid({ id: "b3", subcontractorId: "s3", companyName: "C", status: "sent" }),
      ],
    };

    const result = collectFallbackSuppliers({
      categories,
      bidsByCategory,
    });

    expect(result.suppliersByCategory["cat-1"]).toEqual([{ id: "s3", name: "C" }]);
  });

  it("can limit output to selected categories", () => {
    const bidsByCategory = {
      "cat-1": [bid({ id: "b1", subcontractorId: "s1", companyName: "A", status: "sent" })],
      "cat-2": [bid({ id: "b2", subcontractorId: "s2", companyName: "B", status: "sod" })],
    };

    const result = collectFallbackSuppliers({
      categories,
      bidsByCategory,
      categoryIds: ["cat-2"],
    });

    expect(result.categoriesForEnsure.map((c) => c.id)).toEqual(["cat-2"]);
    expect(result.suppliersByCategory["cat-1"]).toBeUndefined();
    expect(result.suppliersByCategory["cat-2"]).toEqual([{ id: "s2", name: "B" }]);
  });
});
