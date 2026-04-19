import React from "react";
import type { ModuleProps } from "@features/command-center/types";
import { useDerivedActions } from "@features/command-center/hooks/useDerivedActions";
import { navigate } from "@shared/routing/router";

const severityBadgeClass: Record<string, string> = {
  critical: "cc-queue-num--red",
  warning: "cc-queue-num--amber",
  info: "cc-queue-num--blue",
};

export const ActionQueueModule: React.FC<ModuleProps> = ({ filterState }) => {
  const actions = useDerivedActions(filterState).slice(0, 8);

  return (
    <div className="cc-panel">
      <div className="cc-panel__head">
        <span className="cc-panel__title cc-panel__title--amber">Akční fronta</span>
        <span className="cc-panel__meta">top {actions.length}</span>
      </div>
      <div className="cc-panel__body cc-panel__body--flush">
        {actions.length === 0 ? (
          <div className="cc-panel__empty">Žádné akce. Všechno je pod kontrolou.</div>
        ) : (
          <ol className="cc-queue">
            {actions.map((action, index) => (
              <li key={action.id} className="cc-queue-item">
                <button
                  type="button"
                  className="cc-queue-item__btn"
                  onClick={() => action.actionUrl && navigate(action.actionUrl)}
                >
                  <span
                    className={`cc-queue-num ${severityBadgeClass[action.severity] ?? ""}`}
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <div className="cc-queue-item__body">
                    <div className="cc-queue-title">{action.title}</div>
                    {action.subtitle && (
                      <div className="cc-queue-sub">{action.subtitle}</div>
                    )}
                  </div>
                  <div className="cc-queue-meta">
                    {action.projectName ?? ""}
                    {action.dueAt && (
                      <span className="cc-queue-meta__d">
                        {formatDueLabel(action.dueAt)}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};

const formatDueLabel = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)} d po DDL`;
  if (diffDays === 0) return "dnes";
  if (diffDays === 1) return "zítra";
  return `${diffDays} d`;
};
