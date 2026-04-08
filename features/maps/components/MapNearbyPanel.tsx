import { useState } from 'react';
import type { Subcontractor } from '@/types';
import { getMarkerColor } from '../utils/markerColors';

interface NearbyItem extends Subcontractor {
  distanceKm: number;
}

interface MapNearbyPanelProps {
  nearby: NearbyItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  radiusKm: number;
  className?: string;
}

export function MapNearbyPanel({
  nearby,
  selectedId,
  onSelect,
  onHover,
  radiusKm,
  className = '',
}: MapNearbyPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-all ${className}`}
      >
        <span className="material-symbols-outlined text-lg text-green-500">groups</span>
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {nearby.length} blízkých
        </span>
      </button>
    );
  }

  return (
    <div
      className={`w-72 rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-xl overflow-hidden flex flex-col max-h-[60vh] ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700/50 shrink-0">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-green-500">groups</span>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Nejbližší
          </span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            {nearby.length}
          </span>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <span className="material-symbols-outlined text-sm text-slate-400">chevron_right</span>
        </button>
      </div>

      {/* Distance badge */}
      <div className="px-3 py-1.5 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700/50 shrink-0">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">radar</span>
          v okruhu {radiusKm} km od stavby
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {nearby.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600 mb-2">
              location_off
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Žádní subdodavatelé v daném okruhu
            </p>
          </div>
        ) : (
          <div className="py-1">
            {nearby.map((sub, index) => {
              const isSelected = selectedId === sub.id;
              const mainColor = getMarkerColor(sub.specialization || []);
              return (
                <button
                  key={sub.id}
                  onClick={() => onSelect(sub.id)}
                  onMouseEnter={() => onHover(sub.id)}
                  onMouseLeave={() => onHover(null)}
                  className={`
                    w-full text-left px-3 py-2 transition-all border-l-3
                    ${isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-900/20 border-l-blue-500'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-700/30 border-l-transparent'
                    }
                  `}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Rank number */}
                    <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                      {index + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      {/* Company name + distance */}
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-xs font-medium text-slate-900 dark:text-white truncate">
                          {sub.company}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                          {sub.distanceKm.toFixed(1)} km
                        </span>
                      </div>

                      {/* Specializations */}
                      {sub.specialization && sub.specialization.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {sub.specialization.slice(0, 2).map(s => (
                            <span
                              key={s}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                              style={{
                                backgroundColor: `${getMarkerColor([s])}20`,
                                color: getMarkerColor([s]),
                                textShadow: '0 0 0 currentColor',
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: getMarkerColor([s]) }}
                              />
                              {s}
                            </span>
                          ))}
                          {sub.specialization.length > 2 && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                              +{sub.specialization.length - 2}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Rating */}
                      {sub.vendorRatingAverage != null && (
                        <div className="flex items-center gap-1 mt-1 text-[10px]">
                          <span className="text-amber-500">
                            {'★'.repeat(Math.round(sub.vendorRatingAverage))}
                          </span>
                          <span className="text-slate-400">{sub.vendorRatingAverage.toFixed(1)}</span>
                        </div>
                      )}
                    </div>

                    {/* Color indicator */}
                    <span
                      className="shrink-0 w-2 h-2 rounded-full mt-1.5"
                      style={{ backgroundColor: mainColor }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
