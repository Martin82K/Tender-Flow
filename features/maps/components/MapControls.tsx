import { useState } from 'react';

interface MapControlsProps {
  onFitBounds: () => void;
  onToggleRegions?: () => void;
  regionsVisible?: boolean;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  onToggleLabels?: () => void;
  labelsVisible?: boolean;
  className?: string;
}

export function MapControls({
  onFitBounds,
  onToggleRegions,
  regionsVisible = false,
  onToggleFullscreen,
  isFullscreen = false,
  onToggleLabels,
  labelsVisible = false,
  className = '',
}: MapControlsProps) {
  const [tooltipId, setTooltipId] = useState<string | null>(null);

  const buttons = [
    {
      id: 'fit',
      icon: 'fit_screen',
      label: 'Přizpůsobit pohled',
      onClick: onFitBounds,
    },
    ...(onToggleLabels
      ? [
          {
            id: 'labels',
            icon: labelsVisible ? 'label' : 'label_off',
            label: labelsVisible ? 'Skrýt názvy firem' : 'Zobrazit názvy firem',
            onClick: onToggleLabels,
            active: labelsVisible,
          },
        ]
      : []),
    ...(onToggleRegions
      ? [
          {
            id: 'regions',
            icon: 'grid_on',
            label: regionsVisible ? 'Skrýt kraje' : 'Zobrazit kraje',
            onClick: onToggleRegions,
            active: regionsVisible,
          },
        ]
      : []),
    ...(onToggleFullscreen
      ? [
          {
            id: 'fullscreen',
            icon: isFullscreen ? 'fullscreen_exit' : 'fullscreen',
            label: isFullscreen ? 'Ukončit celou obrazovku' : 'Celá obrazovka',
            onClick: onToggleFullscreen,
            active: isFullscreen,
          },
        ]
      : []),
  ];

  return (
    <div
      className={`flex flex-col gap-1 rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-lg p-1 ${className}`}
    >
      {buttons.map((btn) => (
        <div key={btn.id} className="relative">
          <button
            onClick={btn.onClick}
            onMouseEnter={() => setTooltipId(btn.id)}
            onMouseLeave={() => setTooltipId(null)}
            className={`
              flex items-center justify-center w-9 h-9 rounded-lg transition-colors
              ${
                'active' in btn && btn.active
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }
            `}
          >
            <span className="material-symbols-outlined text-xl">{btn.icon}</span>
          </button>
          {tooltipId === btn.id && (
            <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs whitespace-nowrap pointer-events-none">
              {btn.label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
