import React from "react";
import type { ModuleProps } from "@features/command-center/types";
import { usePipelineFunnelData } from "@features/command-center/hooks/usePipelineFunnelData";

export const PipelineFunnelModule: React.FC<ModuleProps> = ({ filterState }) => {
  const stages = usePipelineFunnelData(filterState);
  const maxValue = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="cc-panel">
      <div className="cc-panel__head">
        <span className="cc-panel__title cc-panel__title--blue">Pipeline</span>
        <span className="cc-panel__meta">fáze poptávek</span>
      </div>
      <div className="cc-panel__body">
        <div className="cc-funnel">
          {stages.map((stage) => {
            const ratio = stage.count / maxValue;
            return (
              <div key={stage.key} className="cc-funnel__row">
                <span className="cc-funnel__lbl">{stage.label}</span>
                <div className="cc-funnel__bar">
                  <span
                    className={`cc-funnel__fill cc-funnel__fill--${stage.tone}`}
                    style={{ width: `${Math.max(4, ratio * 100)}%` }}
                  />
                </div>
                <span className="cc-funnel__val">{stage.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
