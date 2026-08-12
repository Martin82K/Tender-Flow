import { formatMoney } from "@shared/formatting/numberFormatters";

export interface PipelineCategorySummaryProps {
  title: string;
  sodBudget?: number | null;
  planBudget?: number | null;
}

export const PipelineCategorySummary = ({
  title,
  sodBudget,
  planBudget,
}: PipelineCategorySummaryProps) => (
  <div className="px-6 pt-4">
    <div
      data-testid="pipeline-category-summary"
      data-help-id="kanban-info-bar"
      className="overflow-x-auto"
    >
      <div className="flex min-w-max items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
        <span className="font-semibold text-slate-900 dark:text-white">
          {title}
        </span>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <span className="font-medium text-slate-500 dark:text-slate-400">
          Cena SOD:
        </span>
        <span className="font-semibold text-slate-900 dark:text-white">
          {formatMoney(sodBudget ?? 0)}
        </span>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <span className="font-medium text-slate-500 dark:text-slate-400">
          Interní plán:
        </span>
        <span className="font-semibold text-slate-900 dark:text-white">
          {formatMoney(planBudget ?? 0)}
        </span>
      </div>
    </div>
  </div>
);
