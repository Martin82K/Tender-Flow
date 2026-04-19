import React from "react";
import type { ModuleProps, ModuleSettingsProps } from "@features/command-center/types";
import { useTimeline14dData } from "@features/command-center/hooks/useTimeline14dData";
import { navigate } from "@shared/routing/router";

const RANGE_OPTIONS: number[] = [7, 14, 30];

export const Timeline14dModule: React.FC<ModuleProps> = ({ settings, filterState }) => {
  const rangeRaw = Number(settings?.rangeDays);
  const range = RANGE_OPTIONS.includes(rangeRaw) ? rangeRaw : 14;
  const { lanes, days } = useTimeline14dData({ ...filterState, rangeDays: range as 7 | 14 | 30 });

  return (
    <div className="cc-panel">
      <div className="cc-panel__head">
        <span className="cc-panel__title cc-panel__title--blue">Timeline {range} dní</span>
        <span className="cc-panel__meta">deadliny, smlouvy, kontrolní dny</span>
      </div>
      <div className="cc-panel__body">
        <div className="cc-timeline">
          <div
            className="cc-timeline__header"
            style={{ gridTemplateColumns: `160px repeat(${days.length}, 1fr)` }}
          >
            <span />
            {days.map((d) => (
              <span key={d.iso} className="cc-timeline__day">
                {d.label}
              </span>
            ))}
          </div>
          {lanes.length === 0 ? (
            <div className="cc-panel__empty">Žádné události v zvoleném rozsahu.</div>
          ) : (
            lanes.map((lane) => (
              <div
                key={lane.projectId}
                className="cc-timeline__lane"
                style={{ gridTemplateColumns: `160px repeat(${days.length}, 1fr)` }}
              >
                <span className="cc-timeline__lane-name">{lane.projectName}</span>
                {days.map((d) => {
                  const events = lane.byDate[d.iso] ?? [];
                  return (
                    <div key={d.iso} className="cc-timeline__cell">
                      {events.slice(0, 3).map((evt) => (
                        <button
                          key={evt.id}
                          type="button"
                          className={`cc-timeline__dot cc-timeline__dot--${evt.tone}`}
                          title={evt.title}
                          onClick={() => evt.actionUrl && navigate(evt.actionUrl)}
                        >
                          <span className="cc-timeline__dot-label">{evt.icon}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const Timeline14dSettings: React.FC<ModuleSettingsProps> = ({ settings, onSettingsChange }) => {
  const current = Number(settings?.rangeDays) || 14;
  return (
    <div className="cc-module-settings">
      <div className="cc-module-settings__label">Rozsah dní</div>
      <div className="cc-module-settings__options">
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            className={`cc-chip ${current === r ? "cc-chip--active cc-chip--blue" : ""}`}
            onClick={() => onSettingsChange({ ...settings, rangeDays: r })}
          >
            {r} dní
          </button>
        ))}
      </div>
    </div>
  );
};
