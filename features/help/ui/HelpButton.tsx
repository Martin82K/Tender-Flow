import React from "react";
import { useHelp } from "../hooks/useHelp";

export const HelpButton: React.FC = () => {
  const { isActive, toggle } = useHelp();

  return (
    <button
      onClick={toggle}
      className={`
        relative flex items-center justify-center size-10 rounded-xl border transition-all duration-200
        ${isActive
          ? "bg-primary/10 border-primary/30 text-primary dark:bg-primary/20 dark:border-primary/40 shadow-sm shadow-primary/10"
          : "bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/80 hover:text-slate-700 dark:hover:text-slate-300"
        }
      `}
      title="Nápověda (F1)"
      aria-label="Zobrazit nápovědu"
      aria-pressed={isActive}
    >
      <span className="material-symbols-outlined text-[20px]">help</span>
      {isActive && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary help-indicator-pulse" />
      )}
    </button>
  );
};
