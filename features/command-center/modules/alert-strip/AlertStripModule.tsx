import React from "react";
import type { ModuleProps } from "@features/command-center/types";
import { useDerivedActions } from "@features/command-center/hooks/useDerivedActions";
import { navigate } from "@shared/routing/router";

export const AlertStripModule: React.FC<ModuleProps> = ({ filterState }) => {
  const actions = useDerivedActions(filterState);
  const critical = actions.filter((a) => a.severity === "critical").slice(0, 4);

  if (critical.length === 0) {
    return (
      <div className="cc-alert-strip cc-alert-strip--quiet">
        <span className="cc-alert-strip__label cc-alert-strip__label--quiet">
          VELITELSKÝ MŮSTEK
        </span>
        <div className="cc-alert-strip__items">
          <span className="cc-alert-strip__quiet-msg">
            Aktuálně žádné kritické signály. Dobrá práce.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="cc-alert-strip">
      <span className="cc-alert-strip__label">KRITICKÉ</span>
      <div className="cc-alert-strip__items">
        {critical.map((action) => (
          <button
            key={action.id}
            type="button"
            className="cc-alert-item"
            onClick={() => {
              if (action.actionUrl) navigate(action.actionUrl);
            }}
          >
            <span className="cc-alert-item__tag">{action.projectName ?? "—"}</span>
            <span>{action.title}</span>
            {action.subtitle && (
              <span className="cc-alert-item__dim">{action.subtitle}</span>
            )}
          </button>
        ))}
      </div>
      <span className="cc-alert-strip__count">{actions.length} celkem</span>
    </div>
  );
};
