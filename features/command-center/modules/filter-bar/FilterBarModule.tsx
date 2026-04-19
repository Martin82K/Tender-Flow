import React from "react";
import type { ModuleProps } from "@features/command-center/types";
import { useAppData } from "@/hooks/useAppData";
import { useUI } from "@/context/UIContext";

const RANGE_OPTIONS: Array<{ value: 7 | 14 | 30 | 90; label: string }> = [
  { value: 7, label: "7 dní" },
  { value: 14, label: "14 dní" },
  { value: 30, label: "30 dní" },
  { value: 90, label: "90 dní" },
];

const HEALTH_OPTIONS: Array<{
  value: "ok" | "warn" | "crit";
  label: string;
  tone: string;
}> = [
  { value: "crit", label: "Kritické", tone: "red" },
  { value: "warn", label: "Pozor", tone: "amber" },
  { value: "ok", label: "OK", tone: "green" },
];

export const FilterBarModule: React.FC<ModuleProps> = ({ filterState, onFilterChange }) => {
  const { showUiModal } = useUI();
  const { state } = useAppData(showUiModal);
  const projects = state.projects.filter((p) => p.status !== "archived");

  const toggleProject = (id: string) => {
    const next = filterState.projectIds.includes(id)
      ? filterState.projectIds.filter((p) => p !== id)
      : [...filterState.projectIds, id];
    onFilterChange({ projectIds: next });
  };

  const toggleHealth = (value: "ok" | "warn" | "crit") => {
    const next = filterState.healthLevels.includes(value)
      ? filterState.healthLevels.filter((h) => h !== value)
      : [...filterState.healthLevels, value];
    onFilterChange({ healthLevels: next });
  };

  const clearFilters = () => {
    onFilterChange({ projectIds: [], healthLevels: [] });
  };

  const hasActive =
    filterState.projectIds.length > 0 || filterState.healthLevels.length > 0;

  return (
    <div className="cc-filterbar">
      <span className="cc-filterbar__label">FILTR</span>
      <span className="cc-filterbar__sep" aria-hidden />
      <div className="cc-filterbar__group" aria-label="Zakázky">
        {projects.slice(0, 8).map((project) => {
          const active = filterState.projectIds.includes(project.id);
          return (
            <button
              key={project.id}
              type="button"
              className={`cc-chip ${active ? "cc-chip--active cc-chip--blue" : ""}`}
              onClick={() => toggleProject(project.id)}
            >
              {project.name}
            </button>
          );
        })}
        {projects.length === 0 && (
          <span className="cc-filterbar__muted">Žádné zakázky</span>
        )}
      </div>
      <span className="cc-filterbar__sep" aria-hidden />
      <div className="cc-filterbar__group" aria-label="Zdraví">
        {HEALTH_OPTIONS.map((opt) => {
          const active = filterState.healthLevels.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              className={`cc-chip cc-chip--${opt.tone} ${active ? "cc-chip--active" : ""}`}
              onClick={() => toggleHealth(opt.value)}
            >
              <span className="cc-chip__dot" aria-hidden />
              {opt.label}
            </button>
          );
        })}
      </div>
      <span className="cc-filterbar__sep" aria-hidden />
      <div className="cc-filterbar__group" aria-label="Rozsah">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`cc-chip ${filterState.rangeDays === opt.value ? "cc-chip--active cc-chip--blue" : ""}`}
            onClick={() => onFilterChange({ rangeDays: opt.value })}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {hasActive && (
        <>
          <span className="cc-filterbar__sep" aria-hidden />
          <button type="button" className="cc-chip cc-chip--ghost" onClick={clearFilters}>
            Zrušit filtry
          </button>
        </>
      )}
    </div>
  );
};
