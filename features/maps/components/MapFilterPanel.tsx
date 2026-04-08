import { useState, useMemo } from 'react';
import { MAPS_CONFIG } from '@/config/maps';

interface MapFilterPanelProps {
  /** All available specializations */
  specializations: string[];
  /** Currently selected specializations */
  activeSpecs: string[];
  onSpecToggle: (spec: string) => void;
  onSpecsClear: () => void;
  onSpecsSelectAll: () => void;
  /** Dynamic color map: spec → color (assigned on selection) */
  colorMap: Record<string, string>;
  /** All available regions */
  regions: string[];
  /** Currently selected region */
  activeRegion: string;
  onRegionChange: (region: string) => void;
  /** Radius config */
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  maxRadius?: number;
  /** Stats */
  totalCount: number;
  geocodedCount: number;
  visibleCount: number;
  className?: string;
}

export function MapFilterPanel({
  specializations,
  activeSpecs,
  onSpecToggle,
  onSpecsClear,
  onSpecsSelectAll,
  colorMap,
  regions,
  activeRegion,
  onRegionChange,
  radiusKm,
  onRadiusChange,
  maxRadius = MAPS_CONFIG.maxRadius,
  totalCount,
  geocodedCount,
  visibleCount,
  className = '',
}: MapFilterPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [specSearch, setSpecSearch] = useState('');

  const allSelected = activeSpecs.length === specializations.length && specializations.length > 0;

  const filteredSpecs = useMemo(() => {
    if (!specSearch.trim()) return specializations;
    const q = specSearch.toLowerCase();
    return specializations.filter(s => s.toLowerCase().includes(q));
  }, [specializations, specSearch]);

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-all ${className}`}
      >
        <span className="material-symbols-outlined text-lg text-blue-500">tune</span>
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Filtry</span>
        {activeSpecs.length > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
            {activeSpecs.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={`w-64 rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-blue-500">tune</span>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Filtry
          </span>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <span className="material-symbols-outlined text-sm text-slate-400">chevron_left</span>
        </button>
      </div>

      {/* Stats */}
      <div className="px-3 py-2 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <span className="material-symbols-outlined text-xs text-blue-500">visibility</span>
            <span className="font-semibold text-slate-900 dark:text-white">{visibleCount}</span>
            <span>viditelných</span>
          </div>
          <span className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
          <div className="text-slate-400 dark:text-slate-500">
            {geocodedCount}/{totalCount} geokód.
          </div>
        </div>
      </div>

      {/* Radius */}
      <div className="px-3 py-3 border-b border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">radar</span>
            Vzdálenost
          </span>
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
            {radiusKm} km
          </span>
        </div>
        <input
          type="range"
          min={5}
          max={maxRadius}
          step={5}
          value={radiusKm}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-200 dark:bg-slate-600 accent-blue-500 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
        />
        <div className="flex justify-between mt-1 text-[10px] text-slate-400 dark:text-slate-500">
          <span>5 km</span>
          <span>{maxRadius} km</span>
        </div>
      </div>

      {/* Region */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/50">
        <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">map</span>
          Region
        </div>
        <select
          value={activeRegion}
          onChange={(e) => onRegionChange(e.target.value)}
          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
        >
          <option value="">Všechny regiony</option>
          {regions.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Specializations */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">category</span>
            Specializace
          </span>
          <div className="flex items-center gap-2">
            {!allSelected && specializations.length > 0 && (
              <button
                onClick={onSpecsSelectAll}
                className="text-[10px] text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                Vše
              </button>
            )}
            {activeSpecs.length > 0 && (
              <button
                onClick={onSpecsClear}
                className="text-[10px] text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-colors"
              >
                Zrušit ({activeSpecs.length})
              </button>
            )}
          </div>
        </div>
        {specializations.length > 5 && (
          <div className="relative mb-1.5">
            <span className="material-symbols-outlined text-xs text-slate-400 absolute left-2 top-1/2 -translate-y-1/2">search</span>
            <input
              type="text"
              value={specSearch}
              onChange={(e) => setSpecSearch(e.target.value)}
              placeholder="Hledat specializaci…"
              className="w-full text-xs pl-7 pr-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
            />
            {specSearch && (
              <button
                onClick={() => setSpecSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            )}
          </div>
        )}
        <div className="max-h-40 overflow-y-auto space-y-0.5 -mx-1 px-1">
          {filteredSpecs.length === 0 ? (
            <div className="text-[11px] text-slate-400 py-2 text-center">
              {specSearch ? 'Žádné výsledky' : 'Žádné specializace'}
            </div>
          ) : (
            filteredSpecs.map(spec => {
              const isActive = activeSpecs.includes(spec);
              const dynamicColor = colorMap[spec];
              return (
                <button
                  key={spec}
                  onClick={() => onSpecToggle(spec)}
                  className={`
                    w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all text-xs
                    ${isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }
                  `}
                >
                  <span
                    className={`w-3 h-3 rounded-full shrink-0 border-2 transition-all ${
                      isActive
                        ? 'border-white dark:border-slate-600 scale-110 shadow-sm'
                        : 'border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-600'
                    }`}
                    style={isActive && dynamicColor ? { backgroundColor: dynamicColor } : undefined}
                  />
                  <span className={`flex-1 truncate ${
                    isActive
                      ? 'font-medium text-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}>
                    {spec}
                  </span>
                  {isActive && (
                    <span className="material-symbols-outlined text-sm" style={{ color: dynamicColor }}>
                      check
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
