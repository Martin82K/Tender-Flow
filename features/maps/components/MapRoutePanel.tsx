import { formatDecimal } from '@/utils/formatters';

interface MapRoutePanelProps {
  distanceMeters?: number;
  durationSeconds?: number;
  isLoading?: boolean;
  error?: string | null;
  targetLabel?: string;
  onClose?: () => void;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return km >= 100
    ? `${formatDecimal(km, { maximumFractionDigits: 0 })} km`
    : `${formatDecimal(km, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

function formatDuration(seconds: number): string {
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${m} min`;
}

export function MapRoutePanel({
  distanceMeters,
  durationSeconds,
  isLoading,
  error,
  targetLabel,
  onClose,
}: MapRoutePanelProps) {
  return (
    <div className="rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-lg px-3 py-2.5 w-60">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">directions_car</span>
          Trasa (auto)
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="Zavřít panel trasy"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        )}
      </div>

      {targetLabel && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mb-1.5" title={targetLabel}>
          → {targetLabel}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
          Počítám trasu…
        </div>
      )}

      {error && !isLoading && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <span className="material-symbols-outlined text-sm shrink-0">warning</span>
          <span>{error}</span>
        </div>
      )}

      {!isLoading && !error && distanceMeters != null && durationSeconds != null && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-blue-500">straighten</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
              {formatDistance(distanceMeters)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-blue-500">schedule</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
              {formatDuration(durationSeconds)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
