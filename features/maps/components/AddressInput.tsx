import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAddressSuggest } from '../hooks/useAddressSuggest';

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: { address: string; city?: string; lat: number; lng: number }) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function AddressInput({
  value,
  onChange,
  onSelect,
  placeholder = 'Zadejte adresu…',
  label,
  disabled = false,
  className = '',
}: AddressInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const listRef = useRef<HTMLUListElement>(null);

  const { suggestions, isLoading, clear } = useAddressSuggest(value);

  // Open dropdown when suggestions arrive
  useEffect(() => {
    if (suggestions.length > 0) {
      setIsOpen(true);
      setActiveIndex(-1);
    }
  }, [suggestions]);

  const handleSelect = useCallback(
    (index: number) => {
      const item = suggestions[index];
      if (!item) return;

      onSelect({
        address: item.label,
        city: item.locality,
        lat: item.position.lat,
        lng: item.position.lng,
      });
      onChange(item.label);
      setIsOpen(false);
      clear();
    },
    [suggestions, onSelect, onChange, clear]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
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
    [isOpen, suggestions.length, activeIndex, handleSelect]
  );

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      setActiveIndex(-1);
    }, 200);
  }, []);

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    if (suggestions.length > 0) setIsOpen(true);
  }, [suggestions.length]);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `address-option-${activeIndex}` : undefined}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="material-symbols-outlined text-slate-400 animate-spin text-lg">
              progress_activity
            </span>
          </div>
        )}
        {!isLoading && value && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg py-1"
        >
          {suggestions.map((item, index) => (
            <li
              key={`${item.label}-${index}`}
              id={`address-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={() => handleSelect(index)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex items-start gap-2 px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                index === activeIndex
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-slate-400 text-base mt-0.5 shrink-0">
                location_on
              </span>
              <div className="min-w-0">
                <div className="truncate font-medium">{item.label}</div>
                {item.locality && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
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
