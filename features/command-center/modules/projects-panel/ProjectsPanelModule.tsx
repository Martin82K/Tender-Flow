import React from "react";
import type { ModuleProps } from "@features/command-center/types";
import { useProjectsPanelData } from "@features/command-center/hooks/useProjectsPanelData";
import { navigate } from "@shared/routing/router";
import { buildAppUrl } from "@shared/routing/routeUtils";

const formatCZK = (value: number) => {
  if (!Number.isFinite(value) || value === 0) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M Kč`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} tis. Kč`;
  return `${Math.round(value)} Kč`;
};

const healthClass: Record<"ok" | "warn" | "crit", string> = {
  ok: "cc-project-row--flag-green",
  warn: "cc-project-row--flag-amber",
  crit: "cc-project-row--flag-red",
};

export const ProjectsPanelModule: React.FC<ModuleProps> = ({ filterState }) => {
  const rows = useProjectsPanelData(filterState);

  if (rows.length === 0) {
    return (
      <div className="cc-panel">
        <div className="cc-panel__head">
          <span className="cc-panel__title">Portfolio zakázek</span>
        </div>
        <div className="cc-panel__body cc-panel__empty">
          Žádné zakázky neodpovídají zvolenému filtru.
        </div>
      </div>
    );
  }

  return (
    <div className="cc-panel">
      <div className="cc-panel__head">
        <span className="cc-panel__title">Portfolio zakázek ({rows.length})</span>
      </div>
      <div className="cc-panel__body cc-panel__body--flush">
        <div className="cc-project-stack">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`cc-project-row ${healthClass[row.health]}`}
              onClick={() =>
                navigate(buildAppUrl("project", { projectId: row.id, tab: "overview" }))
              }
            >
              <span className={`cc-health cc-health--${row.health === "ok" ? "g" : row.health === "warn" ? "a" : "r"}`} aria-hidden />
              <div>
                <div className="cc-project-row__name">{row.name}</div>
                <div className="cc-project-row__sub">{row.location || "—"}</div>
              </div>
              <div>
                <div className="cc-row-label">POKRYTÍ</div>
                <div className="cc-row-value">
                  <strong>{row.coveragePct}%</strong>
                  <div className="cc-bar">
                    <span
                      style={{
                        width: `${row.coveragePct}%`,
                        background:
                          row.coveragePct >= 95
                            ? "var(--cc-green)"
                            : row.coveragePct >= 70
                            ? "var(--cc-amber)"
                            : "var(--cc-red)",
                      }}
                    />
                  </div>
                </div>
              </div>
              <div>
                <div className="cc-row-label">NEJBLIŽŠÍ DDL</div>
                <div className="cc-row-value">
                  {row.nextDeadlineLabel ?? "—"}
                </div>
              </div>
              <div>
                <div className="cc-row-label">ROZPOČET</div>
                <div className="cc-row-value">{formatCZK(row.budget)}</div>
              </div>
              <div>
                <div className="cc-row-label">ODHAD</div>
                <div className="cc-row-value">
                  <strong
                    style={{
                      color:
                        row.estimate > row.budget * 1.05
                          ? "var(--cc-red)"
                          : "var(--cc-text)",
                    }}
                  >
                    {formatCZK(row.estimate)}
                  </strong>
                </div>
              </div>
              <span className="cc-project-row__chev" aria-hidden>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
