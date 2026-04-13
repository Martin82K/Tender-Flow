import React, { useState, useCallback } from 'react';
import { useAddressSuggest } from '../hooks/useAddressSuggest';

interface MapSearchOverlayProps {
  onFlyTo: (lat: number, lng: number, zoom?: number) => void;
  className?: string;
}

export function MapSearchOverlay({ onFlyTo, className = '' }: MapSearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { suggestions, isLoading, clear } = useAddressSuggest(query);

  const handleSelect = useCallback(
    (index: number) => {
      const item = suggestions[index];
      if (!item) return;
      onFlyTo(item.position.lat, item.position.lng, 14);
      setQuery(item.label);
      setIsOpen(false);
      clear();
    },
    [suggestions, onFlyTo, clear],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) return;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((p) => (p < suggestions.length - 1 ? p + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((p) => (p > 0 ? p - 1 : suggestions.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0) handleSelect(activeIndex);
          break;
        case 'Escape':
          setIsOpen(false);
          setActiveIndex(-1);
          break;
      }
    },
    [isOpen, suggestions.length, activeIndex, handleSelect],
  );

  return (
    <div className={`w-72 ${className}`}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg pointer-events-none">
          search
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length >= 3) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder="Hledat adresu…"
          className="w-full rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-lg pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
        />
        {isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 animate-spin text-lg">
            progress_activity
          </span>
        )}
        {!isLoading && query && (
          <button
            onClick={() => {
              setQuery('');
              clear();
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-lg transition-colors"
          >
            close
          </button>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="mt-1 max-h-48 overflow-auto rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-lg py-1">
          {suggestions.map((item, i) => (
            <li
              key={`${item.label}-${i}`}
              onMouseDown={() => handleSelect(i)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`flex items-start gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ${
                i === activeIndex
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="material-symbols-outlined text-slate-400 text-sm mt-0.5 shrink-0">
                location_on
              </span>
              <div className="min-w-0">
                <div className="truncate font-medium text-xs">{item.label}</div>
                {item.locality && (
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                    {item.locality}
                    {item.region ? `, ${item.region}` : ''}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
