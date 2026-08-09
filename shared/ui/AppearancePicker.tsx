import React, { useEffect, useRef, useState } from "react";

import type { AppearanceOption } from "@/shared/theme/appearanceOptions";

interface AppearancePickerProps<T extends string> {
  label: string;
  icon: string;
  value: T;
  options: ReadonlyArray<AppearanceOption<T>>;
  onChange: (value: T) => void;
  className?: string;
}

export const AppearancePicker = <T extends string>({
  label,
  icon,
  value,
  options,
  onChange,
  className = "",
}: AppearancePickerProps<T>): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = React.useId();
  const selectedIndex = Math.max(0, options.findIndex((option) => option.id === value));
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    optionRefs.current[selectedIndex]?.focus();
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen, selectedIndex]);

  const focusOption = (index: number) => {
    const normalizedIndex = (index + options.length) % options.length;
    optionRefs.current[normalizedIndex]?.focus();
  };

  const handleListboxKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const focusedIndex = optionRefs.current.findIndex(
      (option) => option === document.activeElement,
    );

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(focusedIndex + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusOption(event.key === "Home" ? 0 : options.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div
      ref={rootRef}
      className={`tf-appearance-picker relative flex min-h-8 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 dark:border-slate-700 dark:bg-slate-950 ${className}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-slate-400">
        {icon}
      </span>
      <span className="w-12 text-[10px] font-bold text-slate-600 dark:text-slate-300">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={label}
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        className="tf-appearance-picker-trigger flex min-w-0 flex-1 items-center justify-end gap-1 rounded px-1 py-1 text-right text-[11px] font-bold text-slate-800 outline-none transition-colors hover:bg-slate-200/60 focus-visible:ring-2 focus-visible:ring-primary dark:text-slate-100 dark:hover:bg-slate-800"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <span aria-hidden="true" className="material-symbols-outlined text-[15px]">
          {isOpen ? "expand_less" : "expand_more"}
        </span>
      </button>
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={label}
          onKeyDown={handleListboxKeyDown}
          className="tf-appearance-picker-popover absolute right-1 top-[calc(100%+4px)] z-[120] min-w-36 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/50"
        >
          {options.map((option, index) => {
            const isSelected = option.id === value;
            return (
              <button
                key={option.id}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.id);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                className="tf-appearance-picker-option flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold text-slate-700 outline-none transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[15px] text-slate-400">
                  {option.icon}
                </span>
                <span className="flex-1">{option.label}</span>
                {isSelected && (
                  <span aria-hidden="true" className="material-symbols-outlined text-[15px] text-primary">
                    check
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
