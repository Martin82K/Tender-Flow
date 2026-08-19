import React, { useLayoutEffect, useMemo, useRef } from "react";

import { ThemedSelect, type ThemedSelectOption } from "@shared/ui/ThemedSelect";

type NativeSelectValue = string | readonly string[] | number | undefined;

interface ThemedNativeSelectProps
  extends Omit<
    React.SelectHTMLAttributes<HTMLSelectElement>,
    "children" | "defaultValue" | "onChange" | "size" | "value"
  > {
  children: React.ReactNode;
  value?: NativeSelectValue;
  defaultValue?: NativeSelectValue;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  searchable?: boolean;
  multiple?: boolean;
}

const optionLabel = (children: React.ReactNode): string => {
  if (typeof children === "string" || typeof children === "number") return String(children);
  return React.Children.toArray(children).map((child) => optionLabel(child)).join("");
};

const collectOptions = (children: React.ReactNode): Array<ThemedSelectOption<string>> => (
  React.Children.toArray(children).flatMap((child): Array<ThemedSelectOption<string>> => {
    if (!React.isValidElement(child)) return [];
    if (child.type === React.Fragment || child.type === "optgroup") {
      return collectOptions((child.props as { children?: React.ReactNode }).children);
    }
    if (child.type !== "option") return [];
    const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
    return [{
      value: String(props.value ?? optionLabel(props.children)),
      label: props.label || optionLabel(props.children),
      disabled: props.disabled,
    }];
  })
);

/**
 * Compatibility bridge for legacy native selects. It keeps the original option
 * markup and form semantics while rendering the interactive control through the
 * shared, portal-based Tender Flow select.
 */
export const ThemedNativeSelect: React.FC<ThemedNativeSelectProps> = ({
  "aria-label": ariaLabel,
  children,
  className = "",
  defaultValue,
  disabled,
  id,
  name,
  onChange,
  onClick,
  multiple = false,
  required,
  searchable,
  title,
  style,
  value,
}) => {
  const hiddenSelectRef = useRef<HTMLSelectElement>(null);
  const multipleListboxRef = useRef<HTMLDivElement>(null);
  const options = useMemo(() => collectOptions(children), [children]);
  const selectedValues = Array.isArray(value)
    ? value.map(String)
    : Array.isArray(defaultValue)
      ? defaultValue.map(String)
      : [String(value ?? defaultValue ?? options[0]?.value ?? "")];
  const selectedValue = Array.isArray(value)
    ? String(value[0] ?? "")
    : String(value ?? defaultValue ?? options[0]?.value ?? "");
  const accessibleLabel = ariaLabel || title || name || options[0]?.label || "Výběr";
  const fillsContainer = className.includes("w-full");

  const handleChange = (nextValue: string) => {
    const select = hiddenSelectRef.current;
    if (!select) return;
    select.value = nextValue;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const handleMultipleChange = (nextValue: string) => {
    const select = hiddenSelectRef.current;
    if (!select) return;
    const nextValues = new Set(selectedValues);
    if (nextValues.has(nextValue)) nextValues.delete(nextValue);
    else nextValues.add(nextValue);
    Array.from(select.options).forEach((option) => {
      option.selected = nextValues.has(option.value);
    });
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };

  useLayoutEffect(() => {
    const listbox = multipleListboxRef.current;
    const select = hiddenSelectRef.current;
    if (!listbox || !select) return;
    Object.defineProperties(listbox, {
      options: { configurable: true, get: () => select.options },
      selectedOptions: { configurable: true, get: () => select.selectedOptions },
      value: {
        configurable: true,
        get: () => select.value,
        set: (nextValue: string) => { select.value = nextValue; },
      },
    });
  }, [multiple, options]);

  return (
    <>
      {multiple ? (
        <div
          ref={multipleListboxRef}
          role="listbox"
          aria-label={accessibleLabel}
          aria-multiselectable="true"
          onChange={() => {
            const select = hiddenSelectRef.current;
            if (select) select.dispatchEvent(new Event("change", { bubbles: true }));
          }}
          className={`tf-themed-select-popover max-h-48 overflow-y-auto rounded-lg border p-1 shadow-sm ${className}`}
        >
          {options.map((option) => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={disabled || option.disabled}
                onClick={() => handleMultipleChange(option.value)}
                className="tf-themed-select-option flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                  {isSelected ? "check_box" : "check_box_outline_blank"}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <ThemedSelect
          ariaLabel={accessibleLabel}
          value={selectedValue}
          options={options}
          onChange={handleChange}
          disabled={disabled}
          searchable={searchable ?? options.length > 12}
          className={fillsContainer ? "min-w-0 w-full" : "min-w-0"}
          triggerClassName={className}
          triggerStyle={style}
          triggerId={id}
          triggerTitle={title}
          onTriggerChange={handleChange}
          onTriggerClick={(event) => onClick?.(event as unknown as React.MouseEvent<HTMLSelectElement>)}
        />
      )}
      {React.createElement(
        "select",
        {
          ref: hiddenSelectRef,
          id: id ? `${id}-native` : undefined,
          name,
          value: multiple ? selectedValues : selectedValue,
          multiple,
          onChange,
          disabled,
          required,
          hidden: true,
          tabIndex: -1,
          "aria-hidden": true,
          className: "sr-only pointer-events-none absolute size-px opacity-0",
        },
        children,
      )}
    </>
  );
};
