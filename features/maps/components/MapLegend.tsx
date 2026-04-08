import { MAPS_CONFIG } from '@/config/maps';

interface MapLegendProps {
  /** When provided, only these specializations are shown */
  activeSpecs?: string[];
  /** Dynamic color map: spec → color */
  colorMap?: Record<string, string>;
  /** Optional: counts per specialization */
  counts?: Record<string, number>;
  className?: string;
  compact?: boolean;
}

export function MapLegend({ activeSpecs, colorMap, counts, className = '', compact = false }: MapLegendProps) {
  const staticColors = MAPS_CONFIG.colors;

  // Build entries: use colorMap if provided, fall back to static config
  const entries: [string, string][] = activeSpecs
    ? activeSpecs.map(spec => [spec, colorMap?.[spec] || staticColors[spec] || staticColors.default] as [string, string])
    : Object.entries(staticColors).filter(([key]) => key !== 'default');

  if (entries.length === 0) return null;

  if (compact) {
    return (
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm px-3 py-2 shadow-lg border border-slate-200/50 dark:border-slate-700/50 ${className}`}
      >
        {entries.map(([label, color]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full shrink-0 border border-white dark:border-slate-700"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
              {label}
              {counts?.[label] != null && (
                <span className="ml-1 text-slate-400 dark:text-slate-500">({counts[label]})</span>
              )}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm p-3 shadow-lg border border-slate-200/50 dark:border-slate-700/50 ${className}`}
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
            <span className="text-sm text-slate-700 dark:text-slate-200 flex-1">{label}</span>
            {counts?.[label] != null && (
              <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">{counts[label]}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
