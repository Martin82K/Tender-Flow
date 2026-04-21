import React from "react";
import type { ModuleProps } from "@features/command-center/types";
import { useMatrixHealthData } from "@features/command-center/hooks/useMatrixHealthData";

const toneClass: Record<string, string> = {
  ok: "cc-matrix__cell--ok",
  warn: "cc-matrix__cell--warn",
  crit: "cc-matrix__cell--crit",
  new: "cc-matrix__cell--new",
  done: "cc-matrix__cell--done",
  empty: "cc-matrix__cell--empty",
};

export const MatrixHealthModule: React.FC<ModuleProps> = ({ filterState }) => {
  const { rows, columns } = useMatrixHealthData(filterState);

  if (rows.length === 0 || columns.length === 0) {
    return (
      <div className="cc-panel">
        <div className="cc-panel__head">
          <span className="cc-panel__title cc-panel__title--purple">Matice zdraví</span>
        </div>
        <div className="cc-panel__body cc-panel__empty">
          Nemáme dostatek dat pro matici. Přidejte zakázky a poptávkové kategorie.
        </div>
      </div>
    );
  }

  const columnCount = Math.min(columns.length, 6);
  const gridTemplate = `130px repeat(${columnCount}, 1fr)`;

  return (
    <div className="cc-panel">
      <div className="cc-panel__head">
        <span className="cc-panel__title cc-panel__title--purple">Matice zdraví (projekt × kategorie)</span>
      </div>
      <div className="cc-panel__body">
        <div className="cc-matrix" style={{ gridTemplateColumns: gridTemplate }}>
          <div className="cc-matrix__h" aria-hidden />
          {columns.slice(0, columnCount).map((col) => (
            <div key={col.key} className="cc-matrix__h">
              {col.label}
            </div>
          ))}
          {rows.map((row) => (
            <React.Fragment key={row.projectId}>
              <div className="cc-matrix__rn" title={row.projectName}>
                {row.projectName}
                <span className="cc-matrix__dim">{row.meta ?? ""}</span>
              </div>
              {columns.slice(0, columnCount).map((col) => {
                const cell = row.cells[col.key];
                return (
                  <div
                    key={col.key}
                    className={`cc-matrix__cell ${toneClass[cell?.tone ?? "empty"]}`}
                  >
                    <span className="cc-matrix__cell-top">{cell?.primary ?? "—"}</span>
                    {cell?.secondary && (
                      <span className="cc-matrix__cell-btm">{cell.secondary}</span>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
