import { useState } from 'react';
import { MAP_LAYERS } from '@/config/maps';

interface MapLayerSwitcherProps {
  activeLayer: string;
  onLayerChange: (layerId: string) => void;
  className?: string;
}

export function MapLayerSwitcher({ activeLayer, onLayerChange, className = '' }: MapLayerSwitcherProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeLayerDef = MAP_LAYERS.find(l => l.id === activeLayer) ?? MAP_LAYERS[0];

  return (
    <div className={`relative ${className}`}>
      {/* Collapsed: show active layer button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-lg hover:bg-white dark:hover:bg-slate-800 transition-all group"
        >
          <span className="material-symbols-outlined text-lg text-slate-600 dark:text-slate-400 group-hover:text-blue-500 transition-colors">
            {activeLayerDef.icon}
          </span>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {activeLayerDef.label}
          </span>
          <span className="material-symbols-outlined text-sm text-slate-400">
            layers
          </span>
        </button>
      )}

      {/* Expanded: show all layers */}
      {isExpanded && (
        <>
          {/* Backdrop to close */}
          <div className="fixed inset-0 z-[999]" onClick={() => setIsExpanded(false)} />

          <div className="relative z-[1000] rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Typ mapy
                </span>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm text-slate-400">close</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-2">
              {MAP_LAYERS.map((layer) => {
                const isActive = layer.id === activeLayer;
                return (
                  <button
                    key={layer.id}
                    onClick={() => {
                      onLayerChange(layer.id);
                      setIsExpanded(false);
                    }}
                    className={`
                      flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg transition-all text-center
                      ${isActive
                        ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500/50'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }
                    `}
                  >
                    <span
                      className={`material-symbols-outlined text-2xl ${
                        isActive
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {layer.icon}
                    </span>
                    <span
                      className={`text-[11px] font-medium ${
                        isActive
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {layer.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
