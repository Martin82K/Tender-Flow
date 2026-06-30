import type { ProjectBudget, ProjectBudgetItem, TenderBudgetSummary } from "./budgetTypes";
import { calculateBudgetItemPricing } from "./budgetPricing";

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

export interface BudgetChapterSummary {
  id: string;
  name: string;
  itemCount: number;
  totalPrice: number;
  totalPriceWithVat: number;
}

export interface BudgetObjectSummary {
  id: string;
  name: string;
  itemCount: number;
  totalPrice: number;
  totalPriceWithVat: number;
  chapters: BudgetChapterSummary[];
}

export interface BudgetSummary {
  objectSummaries: BudgetObjectSummary[];
  totalItems: number;
  totalPrice: number;
  totalPriceWithVat: number;
}

export const summarizeBudget = (budget: ProjectBudget): BudgetSummary => {
  const objectSummaries = budget.sheets.map((sheet) => {
    const chapters = sheet.categories.map((category) => {
      const totals = category.items.reduce(
        (acc, item) => {
          const pricing = calculateBudgetItemPricing(item);
          acc.totalPrice += pricing.totalPrice;
          acc.totalPriceWithVat += pricing.totalPriceWithVat;
          return acc;
        },
        { totalPrice: 0, totalPriceWithVat: 0 },
      );

      return {
        id: category.id,
        name: category.name,
        itemCount: category.items.length,
        totalPrice: roundCurrency(totals.totalPrice),
        totalPriceWithVat: roundCurrency(totals.totalPriceWithVat),
      };
    });

    return {
      id: sheet.id,
      name: sheet.name,
      itemCount: chapters.reduce((sum, chapter) => sum + chapter.itemCount, 0),
      totalPrice: roundCurrency(chapters.reduce((sum, chapter) => sum + chapter.totalPrice, 0)),
      totalPriceWithVat: roundCurrency(
        chapters.reduce((sum, chapter) => sum + chapter.totalPriceWithVat, 0),
      ),
      chapters,
    };
  });

  return {
    objectSummaries,
    totalItems: objectSummaries.reduce((sum, object) => sum + object.itemCount, 0),
    totalPrice: roundCurrency(objectSummaries.reduce((sum, object) => sum + object.totalPrice, 0)),
    totalPriceWithVat: roundCurrency(
      objectSummaries.reduce((sum, object) => sum + object.totalPriceWithVat, 0),
    ),
  };
};

export const flattenBudgetItems = (budget: ProjectBudget): ProjectBudgetItem[] =>
  budget.sheets.flatMap((sheet) => sheet.categories.flatMap((category) => category.items));

export const summarizeBudgetByTender = (budget: ProjectBudget): TenderBudgetSummary[] => {
  const byTender = new Map<string, TenderBudgetSummary>();

  flattenBudgetItems(budget).forEach((item) => {
    const demandCategoryId = item.demandCategoryId?.trim();
    if (!demandCategoryId) return;

    const pricing = calculateBudgetItemPricing(item);
    const current = byTender.get(demandCategoryId) ?? {
      demandCategoryId,
      itemCount: 0,
      totalPrice: 0,
      totalPriceWithVat: 0,
    };

    current.itemCount += 1;
    current.totalPrice += pricing.totalPrice;
    current.totalPriceWithVat += pricing.totalPriceWithVat;
    byTender.set(demandCategoryId, current);
  });

  return Array.from(byTender.values()).map((summary) => ({
    ...summary,
    totalPrice: roundCurrency(summary.totalPrice),
    totalPriceWithVat: roundCurrency(summary.totalPriceWithVat),
  }));
};

export const filterBudgetByTender = (
  budget: ProjectBudget,
  demandCategoryId: string,
): ProjectBudget | null => {
  const sheets = budget.sheets
    .map((sheet) => ({
      ...sheet,
      categories: sheet.categories
        .map((category) => ({
          ...category,
          items: category.items.filter((item) => item.demandCategoryId === demandCategoryId),
        }))
        .filter((category) => category.items.length > 0),
    }))
    .filter((sheet) => sheet.categories.length > 0);

  if (sheets.length === 0) return null;

  const filtered = { ...budget, sheets };
  const summary = summarizeBudget(filtered);
  return {
    ...filtered,
    totalPrice: summary.totalPrice,
    totalPriceWithVat: summary.totalPriceWithVat,
  };
};
