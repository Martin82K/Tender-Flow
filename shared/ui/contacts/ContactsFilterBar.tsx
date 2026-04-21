import React from "react";
import { StatusConfig } from "@/types";
import { CZ_REGIONS } from "@/config/constants";
import { ContactsFilterState } from "./contactsFiltersLogic";

const filterSelectClassName =
  "select-no-native-arrow w-full h-12 pl-4 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200 bg-none focus:ring-primary focus:border-primary";

interface ContactsFilterBarProps {
  state: ContactsFilterState;
  statuses: StatusConfig[];
  specializations: string[];
  onSearchChange: (value: string) => void;
  onSpecializationChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onClear: () => void;
  trailingSlot?: React.ReactNode;
}

export const ContactsFilterBar: React.FC<ContactsFilterBarProps> = ({
  state,
  statuses,
  specializations,
  onSearchChange,
  onSpecializationChange,
  onStatusChange,
  onRegionChange,
  onClear,
  trailingSlot,
}) => {
  const selectedRegionLabel =
    state.region !== "all"
      ? CZ_REGIONS.find((r) => r.code === state.region)?.label
      : null;

  const statusLabel = (id: string) =>
    statuses.find((s) => s.id === id)?.label ?? id;

  const hasActiveSearch = state.searchText.trim() !== "";
  const hasActiveTags =
    state.specialization !== "all" ||
    state.status !== "all" ||
    state.region !== "all" ||
    hasActiveSearch;

  return (
    <div className="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4 shadow-sm">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex items-center rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 h-12">
          <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">
            search
          </span>
          <input
            type="text"
            placeholder="Hledat jméno, firmu, specializaci..."
            value={state.searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 ml-2 text-slate-900 dark:text-white placeholder-slate-500"
          />
        </div>

        <div className="relative w-full md:w-56">
          <select
            aria-label="Filtr specializace"
            value={state.specialization}
            onChange={(e) => onSpecializationChange(e.target.value)}
            className={filterSelectClassName}
          >
            <option value="all">Všechny specializace</option>
            {specializations.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            expand_more
          </span>
        </div>

        <div className="relative w-full md:w-48">
          <select
            aria-label="Filtr stavu"
            value={state.status}
            onChange={(e) => onStatusChange(e.target.value)}
            className={filterSelectClassName}
          >
            <option value="all">Všechny stavy</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            expand_more
          </span>
        </div>

        <div className="relative w-full md:w-52">
          <select
            aria-label="Filtr kraje působnosti"
            value={state.region}
            onChange={(e) => onRegionChange(e.target.value)}
            className={filterSelectClassName}
          >
            <option value="all">Všechny kraje působnosti</option>
            {CZ_REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            expand_more
          </span>
        </div>

        {trailingSlot}
      </div>

      {hasActiveTags && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {state.specialization !== "all" && (
            <button
              onClick={() => onSpecializationChange("all")}
              className="flex items-center gap-2 bg-primary/10 dark:bg-primary/20 text-primary px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap hover:bg-red-100 hover:text-red-600 transition-colors"
            >
              {state.specialization}{" "}
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
          {state.status !== "all" && (
            <button
              onClick={() => onStatusChange("all")}
              className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap hover:bg-red-100 hover:text-red-600 transition-colors"
            >
              Stav: {statusLabel(state.status)}{" "}
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
          {state.region !== "all" && (
            <button
              onClick={() => onRegionChange("all")}
              className="flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap hover:bg-red-100 hover:text-red-600 transition-colors"
            >
              Kraj: {selectedRegionLabel}{" "}
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
          {hasActiveSearch && (
            <button
              onClick={() => onSearchChange("")}
              className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap hover:bg-red-100 hover:text-red-600 transition-colors"
            >
              Hledat: "{state.searchText}"{" "}
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
          <button
            onClick={onClear}
            className="text-xs text-slate-500 hover:text-primary underline ml-2"
          >
            Vymazat vše
          </button>
        </div>
      )}
    </div>
  );
};
