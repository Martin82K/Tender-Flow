import React, { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@appica/ui-react";
import { Check, Rocket } from "@appica/icons-react";

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
  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? options[0],
    [options, value],
  );
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(selectedOption?.label ?? "");

  useEffect(() => {
    setInputValue(selectedOption?.label ?? "");
  }, [selectedOption]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) setInputValue(selectedOption?.label ?? "");
  };

  return (
    <div
      className={`tf-appearance-picker flex min-h-8 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 dark:border-slate-700 dark:bg-slate-950 ${className}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-slate-400">
        {icon}
      </span>
      <span className="w-12 text-[10px] font-bold text-slate-600 dark:text-slate-300">
        {label}
      </span>
      <Autocomplete
        items={options}
        value={inputValue}
        onValueChange={setInputValue}
        open={isOpen}
        onOpenChange={handleOpenChange}
        itemToStringValue={(option) => {
          if (typeof option !== "object" || option === null || !("label" in option)) return "";
          return String(option.label);
        }}
        openOnInputClick
        size="sm"
        variant="soft"
      >
        <AutocompleteInput
          aria-label={label}
          className="tf-appearance-picker-trigger min-w-0 flex-1 text-right text-[11px] font-bold"
          startSlot={selectedOption?.id === "space" ? <Rocket aria-hidden="true" size={15} /> : undefined}
          onClick={(event) => {
            event.currentTarget.select();
            setInputValue("");
            setIsOpen(true);
          }}
        />
        <AutocompleteContent
          sideOffset={4}
          align="end"
          className="tf-appearance-picker-popover z-[120] min-w-48"
        >
          <AutocompleteList>
            {options.map((option) => {
              const isSelected = option.id === value;
              return (
                <AutocompleteItem
                  key={option.id}
                  value={option}
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.id);
                    setInputValue(option.label);
                    setIsOpen(false);
                  }}
                  className="tf-appearance-picker-option flex items-center gap-2 text-[11px] font-semibold"
                >
                  {option.id === "space" ? (
                    <Rocket aria-hidden="true" size={15} />
                  ) : (
                    <span aria-hidden="true" className="material-symbols-outlined text-[15px] text-slate-400">
                      {option.icon}
                    </span>
                  )}
                  <span className="flex-1">{option.label}</span>
                  {isSelected && <Check aria-hidden="true" size={15} />}
                </AutocompleteItem>
              );
            })}
          </AutocompleteList>
        </AutocompleteContent>
      </Autocomplete>
    </div>
  );
};
