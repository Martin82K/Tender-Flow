import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatDecimal, parseDecimal } from '@/utils/formatters';

type InputSize = 'sm' | 'md';

interface NumericInputProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  /** Maximální počet desetinných míst. Výchozí 2. Použij 0 pro celá čísla. */
  maxFractionDigits?: number;
  /** Minimální počet desetinných míst při zobrazení formátovaného (po blur). Výchozí 0. */
  minFractionDigits?: number;
  /** Povolit záporné hodnoty. Výchozí true. */
  allowNegative?: boolean;
  /** Zobrazit suffix (např. "Kč" nebo "%"). Neovlivňuje uloženou hodnotu. */
  suffix?: React.ReactNode;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  size?: InputSize;
}

/**
 * Reusable numerický input s českým formátováním.
 *
 * - Ukládá číslo, ne string.
 * - Při focus zobrazí "živou" hodnotu s desetinnou čárkou (bez mezer mezi tisíci), aby se dobře editovala.
 * - Při blur zobrazí plně formátovanou hodnotu: `1 234 567,89`.
 * - Paste toleruje různé formáty: `1 234,56`, `1,234.56`, `1.234,56`, s Kč/EUR/%...
 */
export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  className,
  placeholder,
  disabled,
  required,
  id,
  name,
  maxFractionDigits = 2,
  minFractionDigits = 0,
  allowNegative = true,
  suffix,
  onBlur,
  onFocus,
  size = 'md',
  ...aria
}) => {
  const numericValue = useMemo(
    () => (typeof value === 'number' && Number.isFinite(value) ? value : null),
    [value],
  );

  const formatted = useMemo(
    () =>
      numericValue === null
        ? ''
        : formatDecimal(numericValue, {
            minimumFractionDigits: minFractionDigits,
            maximumFractionDigits: maxFractionDigits,
          }),
    [numericValue, minFractionDigits, maxFractionDigits],
  );

  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState(formatted);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pokud se hodnota změní zvenku (reset formuláře, load), synchronizujeme display
  useEffect(() => {
    if (!isFocused) setDraft(formatted);
  }, [formatted, isFocused]);

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Přepneme na editovatelný tvar: jen číslo s čárkou, bez mezer
    if (numericValue !== null) {
      setDraft(
        numericValue
          .toLocaleString('cs-CZ', {
            useGrouping: false,
            minimumFractionDigits: 0,
            maximumFractionDigits: maxFractionDigits,
          })
          .replace('.', ','),
      );
      // Selektujeme obsah, aby se dal hned přepsat
      requestAnimationFrame(() => {
        inputRef.current?.select();
      });
    } else {
      setDraft('');
    }
    onFocus?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    const parsed = parseDecimal(draft);
    if (parsed === null) {
      onChange(null);
      setDraft('');
    } else {
      const clamped = allowNegative ? parsed : Math.max(0, parsed);
      onChange(clamped);
      setDraft(
        formatDecimal(clamped, {
          minimumFractionDigits: minFractionDigits,
          maximumFractionDigits: maxFractionDigits,
        }),
      );
    }
    onBlur?.(event);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setDraft(next);
    // Aktualizujeme i "živou" hodnotu, aby formulář měl okamžitě aktuální číslo
    // (důležité, pokud uživatel odešle formulář stiskem Enter bez blur).
    const parsed = parseDecimal(next);
    if (parsed === null && next.trim() === '') {
      onChange(null);
    } else if (parsed !== null) {
      onChange(allowNegative ? parsed : Math.max(0, parsed));
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text');
    const parsed = parseDecimal(pasted);
    if (parsed === null) return; // necháme default (pravděpodobně prázdný / neparsovatelný vstup)
    event.preventDefault();
    const clamped = allowNegative ? parsed : Math.max(0, parsed);
    onChange(clamped);
    setDraft(
      clamped
        .toLocaleString('cs-CZ', {
          useGrouping: false,
          minimumFractionDigits: 0,
          maximumFractionDigits: maxFractionDigits,
        })
        .replace('.', ','),
    );
  };

  const baseClass =
    size === 'sm'
      ? 'w-full px-2.5 py-1.5 rounded-md border text-sm'
      : 'w-full px-3 py-2 rounded-lg border text-sm';

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        id={id}
        name={name}
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPaste={handlePaste}
        aria-label={aria['aria-label']}
        aria-describedby={aria['aria-describedby']}
        className={`${baseClass} ${suffix ? 'pr-10' : ''} ${className ?? ''}`}
        autoComplete="off"
        spellCheck={false}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500 dark:text-slate-400">
          {suffix}
        </span>
      )}
    </div>
  );
};
