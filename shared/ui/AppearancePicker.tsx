import React from "react";

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
  return (
    <label
      className={`tf-appearance-picker flex min-h-10 items-center gap-2 px-2.5 ${className}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-slate-400">
        {icon}
      </span>
      <span className="w-12 text-[10px] font-bold text-slate-600 dark:text-slate-300">
        {label}
      </span>
      <span className="relative min-w-0 flex-1">
        <select
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
          className="tf-appearance-picker-select h-8 w-full appearance-none rounded-md border px-2.5 pr-8 text-right text-[11px] font-bold outline-none transition-colors"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-slate-400"
        >
          expand_more
        </span>
      </span>
    </label>
  );
};
