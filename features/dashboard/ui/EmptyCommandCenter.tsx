import React from "react";

export const EmptyCommandCenter: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <span
        className="material-symbols-outlined text-[48px] text-emerald-500 dark:text-emerald-400"
        aria-hidden="true"
      >
        check_circle
      </span>
      <h4 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
        Vše pod kontrolou
      </h4>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        V nejbližších 30 dnech nic nehoří.
      </p>
    </div>
  );
};
