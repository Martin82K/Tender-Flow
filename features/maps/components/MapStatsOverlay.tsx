interface MapStatsOverlayProps {
  totalContacts: number;
  geocodedCount: number;
  nearbyCount?: number;
  radiusKm?: number;
  specializationCounts?: Record<string, number>;
  className?: string;
}

export function MapStatsOverlay({
  totalContacts,
  geocodedCount,
  nearbyCount,
  radiusKm,
  specializationCounts,
  className = '',
}: MapStatsOverlayProps) {
  const topSpecs = specializationCounts
    ? Object.entries(specializationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
    : [];

  return (
    <div
      className={`rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-lg px-3 py-2 ${className}`}
    >
      <div className="flex items-center gap-3 text-xs">
        {/* Marker count */}
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
          <span className="material-symbols-outlined text-sm text-blue-500">pin_drop</span>
          <span>
            <span className="font-semibold text-slate-900 dark:text-white">{geocodedCount}</span>
            <span className="text-slate-400">/{totalContacts}</span>
          </span>
        </div>

        {/* Nearby in radius */}
        {nearbyCount != null && radiusKm != null && (
          <>
            <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span className="material-symbols-outlined text-sm text-green-500">radar</span>
              <span>
                <span className="font-semibold text-slate-900 dark:text-white">{nearbyCount}</span>
                {' '}v {radiusKm} km
              </span>
            </div>
          </>
        )}

        {/* Top specializations */}
        {topSpecs.length > 0 && (
          <>
            <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5">
              {topSpecs.map(([spec, count]) => (
                <span
                  key={spec}
                  className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] text-slate-500 dark:text-slate-400"
                >
                  {spec} ({count})
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
