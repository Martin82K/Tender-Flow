import type { DemandCategory, TenderPlanItem } from "@/types";

export interface BudgetTenderOption {
  id: string;
  title: string;
  category: DemandCategory;
  plan?: TenderPlanItem;
}

const normalizeTenderName = (value: string) => value.trim().toLowerCase();

export const buildBudgetTenderOptions = (
  categories: DemandCategory[],
  tenderPlans: TenderPlanItem[],
): BudgetTenderOption[] => {
  const plansByCategoryId = new Map<string, TenderPlanItem>();
  const plansByName = new Map<string, TenderPlanItem>();

  tenderPlans.forEach((plan) => {
    if (plan.categoryId && !plansByCategoryId.has(plan.categoryId)) {
      plansByCategoryId.set(plan.categoryId, plan);
    }

    const nameKey = normalizeTenderName(plan.name);
    if (nameKey && !plansByName.has(nameKey)) {
      plansByName.set(nameKey, plan);
    }
  });

  return categories.map((category) => {
    const linkedPlan =
      plansByCategoryId.get(category.id) ?? plansByName.get(normalizeTenderName(category.title));

    return {
      id: category.id,
      title: linkedPlan?.name || category.title,
      category,
      plan: linkedPlan,
    };
  });
};
