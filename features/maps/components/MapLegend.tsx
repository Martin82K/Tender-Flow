import { getAllSpecializationColors } from '../utils/markerColors';

interface MapLegendProps {
  className?: string;
  compact?: boolean;
}

export function MapLegend({ className = '', compact = false }: MapLegendProps) {
  const colors = getAllSpecializationColors();
  const entries = Object.entries(colors);

  if (entries.length === 0) return null;

  if (compact) {
    return (
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-3 py-2 shadow-md border border-slate-200/50 dark:border-slate-700/50 ${className}`}
      >
        {entries.map(([label, color]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full shrink-0 border border-white dark:border-slate-700"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
              {label}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-3 shadow-md border border-slate-200/50 dark:border-slate-700/50 ${className}`}
    >
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
        Specializace
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.map(([label, color]) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className="inline-block w-3.5 h-3.5 rounded-full shrink-0 border-2 border-white dark:border-slate-700"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm text-slate-700 dark:text-slate-200">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
