import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export const SECTION_DEFAULTS = {
  suppliers: true,
  trends: true,
} as const;

export type OverviewSectionId = keyof typeof SECTION_DEFAULTS;

interface OverviewSectionProps {
  id: OverviewSectionId;
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: (id: OverviewSectionId) => void;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  id,
  title,
  subtitle,
  isOpen,
  onToggle,
  children,
  rightSlot,
}) => {
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-4 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/70 dark:border-slate-700/70">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          {subtitle ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {rightSlot}
          <button
            type="button"
            onClick={() => onToggle(id)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {isOpen ? "Skrýt" : "Zobrazit"}
          </button>
        </div>
      </div>
      {isOpen ? <div className="p-5">{children}</div> : null}
    </div>
  );
};
