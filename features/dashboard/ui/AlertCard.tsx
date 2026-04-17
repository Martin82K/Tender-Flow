import React from "react";
import type { Signal } from "@features/dashboard/model/signal";
import {
  SEVERITY_CARD_CLASSES,
  SEVERITY_ICON_CLASSES,
  SEVERITY_ICON_NAME,
} from "@features/dashboard/model/severity";
import { PulseBadge } from "@shared/ui/PulseBadge";

interface AlertCardProps {
  signal: Signal;
  onClick: () => void;
}

const renderChip = (daysUntilDue?: number): React.ReactNode => {
  if (typeof daysUntilDue !== "number") return null;

  if (daysUntilDue < 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-300 whitespace-nowrap">
        Po termínu {Math.abs(daysUntilDue)} d
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 whitespace-nowrap">
      Za {daysUntilDue} d
    </span>
  );
};

export const AlertCard: React.FC<AlertCardProps> = ({ signal, onClick }) => {
  const cardClasses = SEVERITY_CARD_CLASSES[signal.severity];
  const iconClasses = SEVERITY_ICON_CLASSES[signal.severity];
  const iconName = SEVERITY_ICON_NAME[signal.severity];

  return (
    <button
      id={signal.id}
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl p-4 border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 focus:ring-slate-400 ${cardClasses}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`material-symbols-outlined text-[22px] shrink-0 mt-0.5 ${iconClasses}`}
          aria-hidden="true"
        >
          {iconName}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
              {signal.title}
            </h4>
            {signal.severity === "critical" && (
              <PulseBadge
                color="orange"
                className="text-[10px] px-2 py-0.5"
              >
                Urgentní
              </PulseBadge>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
            {signal.description}
          </p>
        </div>
        <div className="shrink-0">{renderChip(signal.daysUntilDue)}</div>
      </div>
    </button>
  );
};
