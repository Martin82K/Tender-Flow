import type { ProjectBudgetItem, ProjectBudgetVatRate } from "./budgetTypes";

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const finiteOrZero = (value: number): number => (Number.isFinite(value) ? value : 0);

const marginMultiplier = (marginPercent: number): number =>
  Math.max(0, 1 + finiteOrZero(marginPercent) / 100);

export interface BudgetPricingInput {
  amount: number;
  unitPrice: number;
  vatRate: ProjectBudgetVatRate;
  marginPercent: number;
}

export interface BudgetPricingTotals {
  totalPrice: number;
  totalPriceWithVat: number;
  marginAmount: number;
}

export const calculateBudgetItemPricing = (item: BudgetPricingInput): BudgetPricingTotals => {
  const amount = finiteOrZero(item.amount);
  const unitPrice = finiteOrZero(item.unitPrice);
  const totalPrice = amount * unitPrice;
  const multiplier = marginMultiplier(item.marginPercent);
  const baseWithoutMargin = multiplier > 0 ? totalPrice / multiplier : 0;
  const marginAmount = totalPrice - baseWithoutMargin;
  const totalPriceWithVat = totalPrice * (1 + finiteOrZero(item.vatRate) / 100);

  return {
    totalPrice: roundCurrency(totalPrice),
    totalPriceWithVat: roundCurrency(totalPriceWithVat),
    marginAmount: roundCurrency(marginAmount),
  };
};

export const withBudgetItemPricing = <T extends BudgetPricingInput>(
  item: T,
): T & Pick<ProjectBudgetItem, "totalPrice" | "totalPriceWithVat" | "marginAmount"> => ({
  ...item,
  ...calculateBudgetItemPricing(item),
});
