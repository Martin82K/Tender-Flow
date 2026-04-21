import React, { useEffect, useRef, useState } from "react";
import { StatusConfig } from "@/types";
import { CZ_REGIONS } from "@/config/constants";
import { ContactsFilterState } from "./contactsFiltersLogic";

const filterSelectClassName =
  "select-no-native-arrow w-full h-12 pl-4 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200 bg-none focus:ring-primary focus:border-primary";

const DEFAULT_DISTANCE_KM = 50;
const MIN_DISTANCE_KM = 5;
const MAX_DISTANCE_KM = 150;
const DISTANCE_STEP_KM = 5;

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
  /** Optional: when provided, the "Nejblíže ke stavbě" filter is enabled */
  hasProjectPosition?: boolean;
  onDistanceChange?: (value: number | null) => void;
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
  hasProjectPosition = false,
  onDistanceChange,
}) => {
  const selectedRegionLabel =
    state.region !== "all"
      ? CZ_REGIONS.find((r) => r.code === state.region)?.label
      : null;

  const statusLabel = (id: string) =>
    statuses.find((s) => s.id === id)?.label ?? id;

  const hasActiveSearch = state.searchText.trim() !== "";
  const distanceActive = state.distanceKm !== null;
  const hasActiveTags =
    state.specialization !== "all" ||
    state.status !== "all" ||
    state.region !== "all" ||
    distanceActive ||
    hasActiveSearch;

  const showDistanceFilter = hasProjectPosition && !!onDistanceChange;

  const [isDistanceMenuOpen, setIsDistanceMenuOpen] = useState(false);
  const distanceMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDistanceMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        distanceMenuRef.current &&
        !distanceMenuRef.current.contains(e.target as Node)
      ) {
        setIsDistanceMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDistanceMenuOpen]);

  const distanceLabel = distanceActive
    ? `Do ${state.distanceKm} km`
    : "Nejblíže ke stavbě";

  return (
    <div className="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4 shadow-sm">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 md:max-w-md flex items-center rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 h-12 min-w-0">
          <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">
            search
          </span>
          <input
            type="text"
            placeholder="Hledat jméno, firmu, specializaci..."
            value={state.searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            className="flex-1 min-w-0 bg-transparent border-none focus:ring-0 ml-2 text-slate-900 dark:text-white placeholder-slate-500"
          />
        </div>

        {showDistanceFilter && (
          <div className="relative w-full md:w-52" ref={distanceMenuRef}>
            <button
              type="button"
              onClick={() => setIsDistanceMenuOpen((prev) => !prev)}
              className={`w-full h-12 px-4 pr-10 text-left rounded-lg border flex items-center gap-2 transition-colors ${
                distanceActive
                  ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200"
                  : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
              title="Filtr podle vzdálenosti od stavby"
            >
              <span className="material-symbols-outlined text-[20px]">
                radar
              </span>
              <span className="text-sm font-medium truncate">
                {distanceLabel}
              </span>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                expand_more
              </span>
            </button>

            {isDistanceMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 p-4 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Vzdálenost od stavby
                  </span>
                  {distanceActive && (
                    <button
                      type="button"
                      onClick={() => onDistanceChange?.(null)}
                      className="text-[11px] text-red-500 hover:text-red-700 transition-colors"
                    >
                      Vypnout
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Maximální vzdálenost
                  </span>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                    {state.distanceKm ?? DEFAULT_DISTANCE_KM} km
                  </span>
                </div>

                <input
                  type="range"
                  min={MIN_DISTANCE_KM}
                  max={MAX_DISTANCE_KM}
                  step={DISTANCE_STEP_KM}
                  value={state.distanceKm ?? DEFAULT_DISTANCE_KM}
                  onChange={(e) => onDistanceChange?.(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-200 dark:bg-slate-600 accent-blue-500 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
                />
                <div className="flex justify-between mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                  <span>{MIN_DISTANCE_KM} km</span>
                  <span>{MAX_DISTANCE_KM} km</span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                  Zobrazí jen kontakty s geokódovanou adresou v daném okruhu od
                  stavby.
                </p>
              </div>
            )}
          </div>
        )}

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
          {distanceActive && onDistanceChange && (
            <button
              onClick={() => onDistanceChange(null)}
              className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap hover:bg-red-100 hover:text-red-600 transition-colors"
            >
              Do {state.distanceKm} km od stavby{" "}
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
