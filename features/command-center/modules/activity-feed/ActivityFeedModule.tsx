import React from "react";
import type { ModuleProps } from "@features/command-center/types";
import { useActivityFeedData } from "@features/command-center/hooks/useActivityFeedData";

export const ActivityFeedModule: React.FC<ModuleProps> = ({ filterState }) => {
  const items = useActivityFeedData(filterState);

  return (
    <div className="cc-panel">
      <div className="cc-panel__head">
        <span className="cc-panel__title cc-panel__title--green">Live aktivita</span>
        <span className="cc-panel__meta">{items.length} událostí</span>
      </div>
      <div className="cc-panel__body cc-panel__body--flush">
        {items.length === 0 ? (
          <div className="cc-panel__empty">Zatím žádná aktivita.</div>
        ) : (
          <ul className="cc-activity">
            {items.map((item) => (
              <li key={item.id} className="cc-activity__item">
                <span className={`cc-activity__dot cc-activity__dot--${item.tone}`} aria-hidden />
                <div className="cc-activity__body">
                  <div className="cc-activity__title">{item.title}</div>
                  {item.subtitle && (
                    <div className="cc-activity__sub">{item.subtitle}</div>
                  )}
                </div>
                <span className="cc-activity__time">{item.timeLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
