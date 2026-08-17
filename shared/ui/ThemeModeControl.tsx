import React, { useRef } from "react";
import { Toggle } from "@appica/ui-react";

import { themeModeOptions } from "@/shared/theme/appearanceOptions";
import type { ThemeMode } from "@/shared/types/theme";

interface ThemeModeControlProps {
  value: ThemeMode;
  onChange: (value: ThemeMode) => void;
  className?: string;
}

export const ThemeModeControl: React.FC<ThemeModeControlProps> = ({
  value,
  onChange,
  className = "",
}) => {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusButton = (index: number) => {
    const normalizedIndex = (index + themeModeOptions.length) % themeModeOptions.length;
    buttonRefs.current[normalizedIndex]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = index + 1;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = index - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = themeModeOptions.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    focusButton(nextIndex);
  };

  return (
    <div className={`tf-theme-mode-control flex min-h-10 items-center gap-2 px-2.5 ${className}`}>
      <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-slate-400">
        brightness_auto
      </span>
      <span className="w-12 text-[10px] font-bold text-slate-600 dark:text-slate-300">
        Režim
      </span>
      <div role="group" aria-label="Režim" className="ml-auto flex shrink-0 items-center gap-0.5">
        {themeModeOptions.map((option, index) => {
          const isSelected = option.id === value;
          return (
            <Toggle
              key={option.id}
              ref={(element) => {
                buttonRefs.current[index] = element;
              }}
              type="button"
              aria-label={option.label}
              aria-pressed={isSelected}
              pressed={isSelected}
              title={`Režim: ${option.label}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onChange(option.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className="tf-theme-mode-button flex size-8 items-center justify-center rounded-md outline-none transition-colors"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[17px]">
                {option.icon}
              </span>
            </Toggle>
          );
        })}
      </div>
    </div>
  );
};
