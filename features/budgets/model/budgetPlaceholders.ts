import type { ProjectBudgetCategory } from "./budgetTypes";

const normalizeCategoryName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const isEmptyPlaceholderBudgetCategory = (
  category: Pick<ProjectBudgetCategory, "name" | "items">,
): boolean =>
  category.items.length === 0
  && normalizeCategoryName(category.name) === "nezarazene polozky";

export const filterDisplayBudgetCategories = <T extends Pick<ProjectBudgetCategory, "name" | "items">>(
  categories: T[],
): T[] => categories.filter((category) => !isEmptyPlaceholderBudgetCategory(category));
