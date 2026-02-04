import type { OverviewAnalytics } from "./overviewAnalytics";
import { formatMoney } from "./overviewAnalytics";

const formatPercent = (value: number) => `${(value * 100).toFixed(1)} %`;

export const buildOverviewChatContext = (
  analytics: OverviewAnalytics,
  selectedProjectLabel: string,
): string => {
  const topSuppliersBySod = [...analytics.suppliers]
    .sort((a, b) => b.sodCount - a.sodCount)
    .slice(0, 6);

  const topSuppliersBySuccess = [...analytics.suppliers]
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 6);

  const topProfitable = [...analytics.categoryProfit]
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 6);

  const topLosses = [...analytics.categoryProfit]
    .filter((c) => c.profit < 0)
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 6);

  const trendLines = analytics.yearTrends.map(
    (trend) =>
      `${trend.year}: objem ${formatMoney(trend.awardedValue)}, SOD ${trend.sodCount}, nabídky ${trend.offerCount}`,
  );

  return [
    "Jsi analytik stavebních výběrových řízení. Odpovídej česky, věcně a stručně.",
    "Používej číselné údaje z poskytnutých dat. Pokud data chybí, napiš to.",
    "",
    `Filtr projektu: ${selectedProjectLabel}`,
    `Celkový objem oceněných zakázek: ${formatMoney(analytics.totals.awardedValue)}`,
    `Celkové nabídky: ${analytics.totals.offerCount}, SOD: ${analytics.totals.sodCount}`,
    "",
    "Nejčastěji zasmluvňovaní dodavatelé:",
    ...topSuppliersBySod.map(
      (supplier) =>
        `- ${supplier.name}: SOD ${supplier.sodCount}, nabídky ${supplier.offerCount}, objem ${formatMoney(
          supplier.totalAwardedValue,
        )}`,
    ),
    "",
    "Dodavatelé s nejvyšší úspěšností:",
    ...topSuppliersBySuccess.map(
      (supplier) =>
        `- ${supplier.name}: úspěšnost ${formatPercent(supplier.successRate)}, SOD ${supplier.sodCount}`,
    ),
    "",
    "Nejziskovější části:",
    ...topProfitable.map(
      (category) =>
        `- ${category.projectName} / ${category.label}: zisk ${formatMoney(category.profit)}`,
    ),
    "",
    "Nejztrátovější části:",
    ...topLosses.map(
      (category) =>
        `- ${category.projectName} / ${category.label}: ztráta ${formatMoney(category.profit)}`,
    ),
    "",
    "Trendy v čase:",
    ...trendLines,
  ]
    .filter(Boolean)
    .join("\n");
};
