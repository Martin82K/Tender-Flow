import React from "react";
import type { ModuleProps } from "@features/command-center/types";
import { usePipelineFunnelData } from "@features/command-center/hooks/usePipelineFunnelData";

export const PipelineFunnelModule: React.FC<ModuleProps> = ({ filterState }) => {
  const data = usePipelineFunnelData(filterState);
  const { stages, snapshotLabel, successPct, avgLeadDays, fastestCategory, slowestCategory, breaching14d } = data;
  const maxValue = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="cc-panel">
      <div className="cc-panel__head">
        <span className="cc-panel__title cc-panel__title--blue">
          Pipeline poptávek <span className="cc-panel__title-sep">·</span> fáze
        </span>
        <div className="cc-funnel__chips">
          <span className="cc-funnel__chip">{snapshotLabel}</span>
          <span className="cc-funnel__chip">úspěšnost {successPct} %</span>
        </div>
      </div>
      <div className="cc-panel__body">
        <div className="cc-funnel">
          {stages.map((stage) => {
            const ratio = stage.count / maxValue;
            const fillPct = stage.count === 0 ? 0 : Math.max(8, ratio * 100);
            return (
              <div key={stage.key} className="cc-funnel__row">
                <span className="cc-funnel__lbl">{stage.label}</span>
                <div className="cc-funnel__bar">
                  <span
                    className={`cc-funnel__fill cc-funnel__fill--${stage.tone}`}
                    style={{ width: `${fillPct}%` }}
                  />
                  {stage.count > 0 && (
                    <span className="cc-funnel__bar-text">{stage.subtext}</span>
                  )}
                </div>
                <span className="cc-funnel__val">{stage.count}</span>
              </div>
            );
          })}
        </div>

        <div className="cc-funnel__footer">
          <div className="cc-funnel__footer-row">
            <span className="cc-funnel__footer-lbl">ø doba poptávka—podpis</span>
            <span className="cc-funnel__footer-val">
              {avgLeadDays !== null ? `${avgLeadDays} dnů` : "—"}
            </span>
          </div>
          <div className="cc-funnel__footer-row">
            <span className="cc-funnel__footer-lbl">Nejrychlejší kat.</span>
            <span className="cc-funnel__footer-val cc-funnel__footer-val--green">
              {fastestCategory
                ? `${fastestCategory.label} · ${fastestCategory.days} d`
                : "—"}
            </span>
          </div>
          <div className="cc-funnel__footer-row">
            <span className="cc-funnel__footer-lbl">Nejpomalejší kat.</span>
            <span className="cc-funnel__footer-val cc-funnel__footer-val--amber">
              {slowestCategory
                ? `${slowestCategory.label} · ${slowestCategory.days} d`
                : "—"}
            </span>
          </div>
          <div className="cc-funnel__footer-row">
            <span className="cc-funnel__footer-lbl">Překročené 14denní limit</span>
            <span className="cc-funnel__footer-val cc-funnel__footer-val--red">
              {breaching14d.count > 0
                ? `${breaching14d.count}${breaching14d.firstLabel ? ` · ${breaching14d.firstLabel}` : ""}`
                : "0"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
