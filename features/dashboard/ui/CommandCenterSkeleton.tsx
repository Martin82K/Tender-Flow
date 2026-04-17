import React from "react";

const placeholderClass = "animate-pulse bg-slate-200 dark:bg-slate-800 rounded-xl";

export const CommandCenterSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
        <div className={`${placeholderClass} h-6 w-64 mb-4`} />
        <div className="space-y-3">
          <div className={`${placeholderClass} h-20 w-full`} />
          <div className={`${placeholderClass} h-20 w-full`} />
          <div className={`${placeholderClass} h-20 w-full`} />
        </div>
      </div>

      <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
        <div className={`${placeholderClass} h-6 w-40 mb-4`} />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`${placeholderClass} h-4 w-20`} />
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6].map((j) => (
                  <div
                    key={j}
                    className={`${placeholderClass} h-6 w-6 rounded-full`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
