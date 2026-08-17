import React from "react";

import type { AppearanceOption } from "@/shared/theme/appearanceOptions";
import { ThemedSelect } from "@/shared/ui/ThemedSelect";

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
      <ThemedSelect
        ariaLabel={label}
        value={value}
        options={options.map((option) => ({ value: option.id, label: option.label }))}
        onChange={onChange}
        className="min-w-0 flex-1"
      />
    </label>
  );
};
