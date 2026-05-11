import { describe, expect, it } from "vitest";
import {
  buildNewDemandCategory,
  calculateInternalPlanFromSodDiscount,
} from "@/features/projects/model/pipelineModel";

const baseForm = {
  title: "Kamenivo",
  sodBudget: "100 000,00",
  planBudget: "95 000,00",
  description: "",
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
});
