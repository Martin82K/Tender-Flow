import React, { useMemo, useState } from "react";
import { Sparkline, SparklineChart } from "@appica/ui-react/sparkline";
import type { MonthlyVolumeTrend } from "@/shared/overview/overviewAnalytics";
import { ThemedSelect } from "@/shared/ui/ThemedSelect";

interface MonthlyVolumeTrendsProps {
  trends: MonthlyVolumeTrend[];
}

type RangeMode = "recent" | "all" | "custom";
type TrendMetric = "tender" | "realization";

const chartWidth = 720;
const chartHeight = 220;
const plot = { left: 64, right: 18, top: 18, bottom: 34 } as const;
const dashPatterns = [undefined, "9 5", "3 4", "12 4 3 4"] as const;
const monthLabels = [
  "Leden",
  "Únor",
  "Březen",
  "Duben",
  "Květen",
  "Červen",
  "Červenec",
  "Srpen",
  "Září",
  "Říjen",
  "Listopad",
  "Prosinec",
] as const;
const compactCurrencyFormatter = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  notation: "compact",
  maximumFractionDigits: 1,
});

const getSeriesColor = (index: number): string => {
  const hue = (204 + index * 137.508) % 360;
  return `hsl(${hue.toFixed(1)} 78% 58%)`;
};

const sumValues = (values: number[]): number => values.reduce((sum, value) => sum + value, 0);

const formatConstructionCount = (count: number): string => {
  if (count === 1) return "1 stavba";
  if (count >= 2 && count <= 4) return `${count} stavby`;
  return `${count} staveb`;
};

const buildSmoothPath = (values: number[], maxValue: number): string => {
  const width = chartWidth - plot.left - plot.right;
  const height = chartHeight - plot.top - plot.bottom;
  const points = values.map((value, index) => ({
    x: plot.left + (index / 11) * width,
    y: plot.top + height - (value / maxValue) * height,
  }));

  if (points.length === 0) return "";
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const midpoint = (previous.x + point.x) / 2;
    return `${path} C ${midpoint} ${previous.y}, ${midpoint} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
};

interface OverlaidMonthlyChartProps {
  metric: TrendMetric;
  title: string;
  subtitle: string;
  trends: MonthlyVolumeTrend[];
  colorIndexByYear: Map<number, number>;
}

const OverlaidMonthlyChart: React.FC<OverlaidMonthlyChartProps> = ({
  metric,
  title,
  subtitle,
  trends,
  colorIndexByYear,
}) => {
  const maxValue = Math.max(0, ...trends.flatMap((trend) => trend[metric]));
  const plotHeight = chartHeight - plot.top - plot.bottom;
  const plotWidth = chartWidth - plot.left - plot.right;
  const accessibleSummary = trends
    .map((trend) => {
      const count = sumValues(trend[`${metric}Count`]);
      return `${trend.year}: ${compactCurrencyFormatter.format(sumValues(trend[metric]))}, ${formatConstructionCount(count)}`;
    })
    .join(", ");

  return (
    <article
      data-chart={metric}
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>

      {maxValue <= 0 ? (
        <div className="flex min-h-48 items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400">
          Pro zvolený rozsah nejsou dostupné nenulové objemy.
        </div>
      ) : (
        <>
          <svg
            role="img"
            aria-label={`${title} podle měsíců`}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="h-auto w-full overflow-visible"
          >
            <desc>{accessibleSummary}</desc>
            {[0, 0.5, 1].map((ratio) => {
              const y = plot.top + plotHeight * ratio;
              const value = maxValue * (1 - ratio);
              return (
                <g key={ratio}>
                  <line
                    x1={plot.left}
                    x2={plot.left + plotWidth}
                    y1={y}
                    y2={y}
                    className="stroke-slate-200 dark:stroke-slate-700"
                    strokeDasharray="3 5"
                  />
                  <text
                    x={plot.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-500 text-[10px] dark:fill-slate-400"
                  >
                    {compactCurrencyFormatter.format(value)}
                  </text>
                </g>
              );
            })}
            {[1, 3, 6, 9, 12].map((month) => {
              const x = plot.left + ((month - 1) / 11) * plotWidth;
              return (
                <text
                  key={month}
                  x={x}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] dark:fill-slate-400"
                >
                  {month}
                </text>
              );
            })}
            {trends.map((trend) => {
              const colorIndex = colorIndexByYear.get(trend.year) ?? 0;
              const total = sumValues(trend[metric]);
              const linePath = buildSmoothPath(trend[metric], maxValue);
              const gradientId = `${metric}-construction-fill-${trend.year}`;
              return (
                <g key={trend.year}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={getSeriesColor(colorIndex)} stopOpacity="0.15" />
                      <stop offset="100%" stopColor={getSeriesColor(colorIndex)} stopOpacity="0.01" />
                    </linearGradient>
                  </defs>
                  <path
                    data-series-fill={trend.year}
                    d={`${linePath} L ${plot.left + plotWidth} ${plot.top + plotHeight} L ${plot.left} ${plot.top + plotHeight} Z`}
                    fill={`url(#${gradientId})`}
                    stroke="none"
                  />
                  <path
                    data-series-year={trend.year}
                    d={linePath}
                    fill="none"
                    stroke={getSeriesColor(colorIndex)}
                    strokeWidth="3"
                    strokeDasharray={dashPatterns[colorIndex % dashPatterns.length]}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  >
                    <title>{`${trend.year}: ${compactCurrencyFormatter.format(total)}`}</title>
                  </path>
                </g>
              );
            })}
          </svg>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2" aria-label={`Legenda grafu ${title}`}>
            {trends.map((trend) => {
              const colorIndex = colorIndexByYear.get(trend.year) ?? 0;
              const total = sumValues(trend[metric]);
              const count = sumValues(trend[`${metric}Count`]);
              return (
                <div key={trend.year} className="flex items-center gap-2 text-xs">
                  <svg aria-hidden="true" width="24" height="6" viewBox="0 0 24 6">
                    <line
                      x1="1"
                      x2="23"
                      y1="3"
                      y2="3"
                      stroke={getSeriesColor(colorIndex)}
                      strokeWidth="3"
                      strokeDasharray={dashPatterns[colorIndex % dashPatterns.length]}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{trend.year}</span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    {compactCurrencyFormatter.format(total)} · {formatConstructionCount(count)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </article>
  );
};

interface TenderMonthlyColumnChartProps {
  trends: MonthlyVolumeTrend[];
  colorIndexByYear: Map<number, number>;
}

const TenderMonthlyColumnChart: React.FC<TenderMonthlyColumnChartProps> = ({
  trends,
  colorIndexByYear,
}) => {
  const maxActiveCount = Math.max(0, ...trends.flatMap((trend) => trend.tenderActiveCount));

  return (
    <article
      data-chart="tender"
      data-chart-variant="column"
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Stavby v soutěži</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Počet aktivních staveb podle měsíců realizace
        </p>
      </div>

      {maxActiveCount <= 0 ? (
        <div className="flex min-h-48 items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400">
          Pro zvolený rozsah nejsou dostupné stavby v soutěži.
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2">
          {trends.map((trend) => {
            const values = trend.tender;
            const activeCounts = trend.tenderActiveCount;
            const normalizedValues = activeCounts.map((value) => value / maxActiveCount);
            const colorIndex = colorIndexByYear.get(trend.year) ?? 0;
            const total = sumValues(values);
            const count = sumValues(trend.tenderCount);

            return (
              <Sparkline
                key={trend.year}
                data-series-year={trend.year}
                data={normalizedValues}
                labels={[...monthLabels]}
                color={getSeriesColor(colorIndex)}
                className="min-w-0 rounded-lg border border-slate-200/80 bg-slate-50/60 p-2.5 dark:border-slate-700 dark:bg-slate-950/35"
              >
                <div className="flex min-w-0 items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{trend.year}</span>
                  <span className="truncate text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {formatConstructionCount(count)} · {compactCurrencyFormatter.format(total)}
                  </span>
                </div>
                <SparklineChart
                  variant="column"
                  baseline={0}
                  height={52}
                  tooltip
                  aria-label={`Počet aktivních staveb v soutěži za rok ${trend.year} podle měsíců`}
                  renderTooltip={(point) => (
                    <div className="flex w-max items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white shadow-xl">
                      <span className="text-slate-400">{point.label}</span>
                      <span className="font-semibold tabular-nums">
                        {formatConstructionCount(activeCounts[point.index] ?? 0)}
                      </span>
                    </div>
                  )}
                />
                <div className="flex justify-between text-[0.6875rem] text-slate-400 dark:text-slate-500" aria-hidden="true">
                  <span>1</span>
                  <span>6</span>
                  <span>12</span>
                </div>
                <span className="sr-only">
                  {activeCounts.map((value, index) => `${monthLabels[index]}: ${formatConstructionCount(value)}`).join(", ")}
                </span>
              </Sparkline>
            );
          })}
        </div>
      )}
    </article>
  );
};

export const MonthlyVolumeTrends: React.FC<MonthlyVolumeTrendsProps> = ({ trends }) => {
  const [rangeMode, setRangeMode] = useState<RangeMode>("recent");
  const years = useMemo(() => trends.map((trend) => trend.year).sort((a, b) => a - b), [trends]);
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const [customStartYear, setCustomStartYear] = useState<number | null>(null);
  const [customEndYear, setCustomEndYear] = useState<number | null>(null);
  const selectedStartYear = customStartYear ?? firstYear;
  const selectedEndYear = customEndYear ?? lastYear;
  const yearOptions = years.map((year) => ({ value: year.toString(), label: year.toString() }));
  const colorIndexByYear = useMemo(
    () => new Map(years.map((year, index) => [year, index])),
    [years],
  );

  const visibleTrends = useMemo(() => {
    if (rangeMode === "all") return trends;
    if (rangeMode === "recent") return trends.slice(-5);
    if (selectedStartYear === undefined || selectedEndYear === undefined) return [];
    return trends.filter((trend) => trend.year >= selectedStartYear && trend.year <= selectedEndYear);
  }, [rangeMode, selectedEndYear, selectedStartYear, trends]);
  if (trends.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Pro trendové grafy nejsou dostupné stavby s obdobím realizace ani termínem dokončení.
      </div>
    );
  }

  const setStartYear = (value: string) => {
    const nextYear = Number(value);
    setCustomStartYear(nextYear);
    if (selectedEndYear !== undefined && nextYear > selectedEndYear) setCustomEndYear(nextYear);
  };

  const setEndYear = (value: string) => {
    const nextYear = Number(value);
    setCustomEndYear(nextYear);
    if (selectedStartYear !== undefined && nextYear < selectedStartYear) setCustomStartYear(nextYear);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Rozsah trendových grafů"
          className="inline-flex rounded-xl border border-slate-200 bg-slate-100/70 p-1 dark:border-slate-700 dark:bg-slate-950/50"
        >
          {([
            ["recent", "Posledních 5 let", "Posledních 5 let"],
            ["all", "Vše", "Všechny roky"],
            ["custom", "Vlastní", "Vlastní rozsah"],
          ] as const).map(([mode, label, ariaLabel]) => (
            <button
              key={mode}
              type="button"
              aria-label={ariaLabel}
              aria-pressed={rangeMode === mode}
              onClick={() => setRangeMode(mode)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                rangeMode === mode
                  ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {rangeMode === "custom" && selectedStartYear !== undefined && selectedEndYear !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Od</span>
            <ThemedSelect
              ariaLabel="Počáteční rok trendu"
              value={selectedStartYear.toString()}
              options={yearOptions}
              onChange={setStartYear}
              className="w-24"
            />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Do</span>
            <ThemedSelect
              ariaLabel="Koncový rok trendu"
              value={selectedEndYear.toString()}
              options={yearOptions}
              onChange={setEndYear}
              className="w-24"
            />
          </div>
        )}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
        <TenderMonthlyColumnChart
          trends={visibleTrends}
          colorIndexByYear={colorIndexByYear}
        />
        <OverlaidMonthlyChart
          metric="realization"
          title="Stavby v realizaci"
          subtitle="Poměrná část hodnoty podle měsíců realizace"
          trends={visibleTrends}
          colorIndexByYear={colorIndexByYear}
        />
      </div>
    </div>
  );
};
