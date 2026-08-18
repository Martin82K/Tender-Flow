import { describe, expect, it } from "vitest";
import {
  buildNewDemandCategory,
  buildUpdatedDemandCategory,
  calculateInternalPlanFromSodDiscount,
} from "@/features/projects/model/pipelineModel";
import type { DemandCategory } from "@/types";

const baseForm = {
  title: "Kamenivo",
  sodBudget: "100 000,00",
  planBudget: "95 000,00",
  description: "",
};

const existingCategory: DemandCategory = {
  id: "cat-1",
  title: "Kamenivo",
  budget: "~100 000,00 Kč",
  sodBudget: 100000,
  planBudget: 95000,
  status: "open",
  subcontractorCount: 0,
  description: "Původní popis",
  workItems: [],
};

describe("pipeline budget model", () => {
  it("keeps a concrete internal plan amount", () => {
    const category = buildNewDemandCategory(baseForm, "cat-1", []);

    expect(category.sodBudget).toBe(100000);
    expect(category.planBudget).toBe(95000);
  });

  it("calculates internal plan from a SOD discount percent", () => {
    const category = buildNewDemandCategory(
      { ...baseForm, planBudget: "5 %" },
      "cat-1",
      [],
    );

    expect(category.planBudget).toBe(95000);
  });

  it("clamps discount percent to the SOD amount range", () => {
    expect(calculateInternalPlanFromSodDiscount(100000, 150)).toBe(0);
    expect(calculateInternalPlanFromSodDiscount(100000, -10)).toBe(100000);
  });

  it("keeps work items when creating a demand category", () => {
    const category = buildNewDemandCategory(
      {
        ...baseForm,
        description: "Montáž rozvaděče\nVýchozí revize",
        workItems: ["Montáž rozvaděče", "Výchozí revize"],
      },
      "cat-1",
      [],
    );

    expect(category.workItems).toEqual(["Montáž rozvaděče", "Výchozí revize"]);
  });

  it("replaces work items when updating a demand category", () => {
    const category = buildUpdatedDemandCategory(
      existingCategory,
      {
        ...baseForm,
        description: "Montáž rozvaděče\nVýchozí revize",
        workItems: ["Montáž rozvaděče", "Výchozí revize"],
      },
      [],
    );

    expect(category.workItems).toEqual(["Montáž rozvaděče", "Výchozí revize"]);
  });
});
