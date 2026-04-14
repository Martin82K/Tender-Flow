import { useState, useMemo, useRef, useEffect, useCallback } from 'react';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called on Enter or when an option is picked */
  onCommit: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  maxResults?: number;
}

/**
 * Themed autocomplete input — replaces native <datalist> which can't be styled
 * for dark mode. Shows a floating suggestion list matching the app's design.
 */
export function AutocompleteInput({
  value,
  onChange,
  onCommit,
  options,
  placeholder,
  className = '',
  maxResults = 50,
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalize = useCallback(
    (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
    [],
  );

  const filtered = useMemo(() => {
    const q = normalize(value.trim());
    if (!q) return options.slice(0, maxResults);
    return options.filter(o => normalize(o).includes(q)).slice(0, maxResults);
  }, [options, value, maxResults, normalize]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const pick = (v: string) => {
    onCommit(v);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div ref={containerRef} className={`relative flex-1 ${className}`}>
      <input
        type="text"
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
            setActiveIndex(i => (i < filtered.length - 1 ? i + 1 : 0));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => (i > 0 ? i - 1 : filtered.length - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (isOpen && activeIndex >= 0 && filtered[activeIndex]) {
              pick(filtered[activeIndex]);
            } else if (value.trim()) {
              pick(value);
            }
          } else if (e.key === 'Escape') {
            setIsOpen(false);
            setActiveIndex(-1);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary text-slate-900 dark:text-white"
      />
      {isOpen && filtered.length > 0 && (
        <ul
          className="absolute z-50 top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1"
          role="listbox"
        >
          {filtered.map((opt, i) => (
            <li
              key={opt}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={e => {
                e.preventDefault();
                pick(opt);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                i === activeIndex
                  ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
