import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ThemedSelectOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface ThemedSelectProps<T extends string> {
  ariaLabel: string;
  value: T;
  options: ReadonlyArray<ThemedSelectOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  searchable?: boolean;
  triggerStyle?: React.CSSProperties;
  onTriggerClick?: React.MouseEventHandler<HTMLButtonElement>;
  onTriggerChange?: (value: string) => void;
  triggerId?: string;
  triggerTitle?: string;
}

interface MenuPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

export const ThemedSelect = <T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
  disabled = false,
  className = "",
  triggerClassName = "",
  searchable = false,
  triggerStyle,
  onTriggerClick,
  onTriggerChange,
  triggerId,
  triggerTitle,
}: ThemedSelectProps<T>): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : options[0];
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase("cs-CZ");
  const visibleOptions = normalizedSearchQuery
    ? options.filter((option) => option.label.toLocaleLowerCase("cs-CZ").includes(normalizedSearchQuery))
    : options;

  const findEnabledIndex = (start: number, direction: 1 | -1): number => {
    if (visibleOptions.length === 0) return -1;
    for (let step = 0; step < visibleOptions.length; step += 1) {
      const index = (start + direction * step + visibleOptions.length) % visibleOptions.length;
      if (!visibleOptions[index]?.disabled) return index;
    }
    return -1;
  };

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const searchHeight = searchable ? 48 : 0;
    const desiredHeight = Math.min(368, Math.max(44, visibleOptions.length * 38 + 8 + searchHeight));
    const roomBelow = window.innerHeight - rect.bottom - viewportPadding;
    const roomAbove = rect.top - viewportPadding;
    const openAbove = roomBelow < Math.min(desiredHeight, 180) && roomAbove > roomBelow;
    const maxHeight = Math.max(80, Math.min(desiredHeight, openAbove ? roomAbove : roomBelow));
    const top = openAbove ? Math.max(viewportPadding, rect.top - maxHeight - 4) : rect.bottom + 4;
    setPosition({
      left: Math.min(rect.left, Math.max(viewportPadding, window.innerWidth - rect.width - viewportPadding)),
      top,
      width: rect.width,
      maxHeight,
    });
  };

  const open = () => {
    if (disabled || options.length === 0) return;
    setSearchQuery("");
    const nextSelectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(findEnabledIndex(nextSelectedIndex >= 0 ? nextSelectedIndex : 0, 1));
    setIsOpen(true);
    if (searchable) requestAnimationFrame(() => searchRef.current?.focus());
  };

  const close = (restoreFocus = false) => {
    setIsOpen(false);
    setPosition(null);
    setSearchQuery("");
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const selectIndex = (index: number) => {
    const option = visibleOptions[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close(true);
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, options.length, searchable, visibleOptions.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    const handleViewportChange = () => updatePosition();
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen, options.length]);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger || !onTriggerChange) return;
    const handleLegacyChange = () => onTriggerChange(trigger.value);
    trigger.addEventListener("change", handleLegacyChange);
    return () => trigger.removeEventListener("change", handleLegacyChange);
  }, [onTriggerChange]);

  const moveActive = (direction: 1 | -1) => {
    const start = activeIndex < 0 ? (direction === 1 ? 0 : visibleOptions.length - 1) : activeIndex + direction;
    setActiveIndex(findEnabledIndex(start, direction));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) open();
      else moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      if (!isOpen) return;
      event.preventDefault();
      setActiveIndex(findEnabledIndex(event.key === "Home" ? 0 : visibleOptions.length - 1, event.key === "Home" ? 1 : -1));
      return;
    }
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      close(true);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && isOpen) {
      event.preventDefault();
      selectIndex(activeIndex);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && !isOpen) {
      event.preventDefault();
      open();
      return;
    }
    if (isOpen && event.key.length === 1 && /\S/.test(event.key)) {
      const query = event.key.toLocaleLowerCase("cs-CZ");
      const match = visibleOptions.findIndex((option) => (
        !option.disabled && option.label.toLocaleLowerCase("cs-CZ").startsWith(query)
      ));
      if (match >= 0) setActiveIndex(match);
    }
  };

  const menu = isOpen && position ? createPortal(
    <div
      ref={menuRef}
      className="tf-themed-select-popover fixed z-[400] overflow-hidden rounded-lg border shadow-xl outline-none"
      style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight }}
    >
      {searchable && (
        <div className="border-b border-slate-200/80 p-2 dark:border-slate-700/70">
          <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-950/70">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-slate-400">search</span>
            <input
              ref={searchRef}
              type="search"
              aria-label={`Hledat v nabídce ${ariaLabel}`}
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  moveActive(event.key === "ArrowDown" ? 1 : -1);
                } else if (event.key === "Enter" && activeIndex >= 0) {
                  event.preventDefault();
                  selectIndex(activeIndex);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  close(true);
                }
              }}
              className="min-w-0 flex-1 border-0 bg-transparent py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-slate-100"
              placeholder="Hledat…"
            />
          </div>
        </div>
      )}
      <div
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel}
        className="overflow-y-auto p-1"
        style={{ maxHeight: searchable ? Math.max(44, position.maxHeight - 49) : position.maxHeight }}
      >
      {visibleOptions.map((option, index) => {
        const isSelected = option.value === value;
        const isActive = index === activeIndex;
        return (
          <button
            key={option.value}
            id={`${listboxId}-option-${index}`}
            type="button"
            role="option"
            aria-selected={isSelected}
            disabled={option.disabled}
            data-active={isActive ? "true" : "false"}
            onMouseEnter={() => { if (!option.disabled) setActiveIndex(index); }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => selectIndex(index)}
            className="tf-themed-select-option flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {isSelected && (
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">check</span>
            )}
          </button>
        );
      })}
      {visibleOptions.length === 0 && (
        <div className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
          Žádná odpovídající položka
        </div>
      )}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={triggerId}
        title={triggerTitle}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-activedescendant={isOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        disabled={disabled}
        value={value}
        onClick={(event) => {
          onTriggerClick?.(event);
          if (event.defaultPrevented) return;
          if (isOpen) close(); else open();
        }}
        onKeyDown={handleKeyDown}
        style={triggerStyle}
        className={`tf-themed-select-trigger flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-2 text-left text-xs shadow-sm outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${triggerClassName}`}
      >
        <span className="min-w-0 flex-1 truncate">{selectedOption?.label || "—"}</span>
        <span aria-hidden="true" className={`material-symbols-outlined text-[16px] transition-transform ${isOpen ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>
      {menu}
    </div>
  );
};
