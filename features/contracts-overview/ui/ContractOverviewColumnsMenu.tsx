import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  CONTRACT_OVERVIEW_PARAMETER_KEYS,
  CONTRACT_OVERVIEW_PARAMETER_LABELS,
  type ContractOverviewParameterKey,
} from "../model/contractOverviewModel";

interface ContractOverviewColumnsMenuProps {
  visible: ReadonlySet<ContractOverviewParameterKey>;
  onToggle: (key: ContractOverviewParameterKey) => void;
}

interface MenuPosition {
  left: number;
  top: number;
  maxHeight: number;
}

export const ContractOverviewColumnsMenu: React.FC<ContractOverviewColumnsMenuProps> = ({ visible, onToggle }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = 288;
    const padding = 8;
    const desiredHeight = Math.min(420, CONTRACT_OVERVIEW_PARAMETER_KEYS.length * 38 + 16);
    const roomBelow = window.innerHeight - rect.bottom - padding;
    const roomAbove = rect.top - padding;
    const above = roomBelow < Math.min(desiredHeight, 220) && roomAbove > roomBelow;
    const maxHeight = Math.max(120, Math.min(desiredHeight, above ? roomAbove : roomBelow));
    setPosition({
      left: Math.max(padding, Math.min(rect.right - width, window.innerWidth - width - padding)),
      top: above ? Math.max(padding, rect.top - maxHeight - 6) : rect.bottom + 6,
      maxHeight,
    });
  };

  const close = (restoreFocus = false) => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const focusFrame = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitemcheckbox"]')?.focus();
    });
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };
    const handleViewportChange = () => updatePosition();
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]') || [])];
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  const menu = open && position ? createPortal(
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label="Viditelné smluvní parametry"
      onKeyDown={handleMenuKeyDown}
      className="tf-themed-select-popover fixed z-[500] w-72 overflow-y-auto rounded-xl border p-2 shadow-xl outline-none"
      style={{ left: position.left, top: position.top, maxHeight: position.maxHeight }}
    >
      {CONTRACT_OVERVIEW_PARAMETER_KEYS.map((key) => {
        const checked = visible.has(key);
        return (
          <button
            key={key}
            type="button"
            role="menuitemcheckbox"
            aria-checked={checked}
            onClick={() => onToggle(key)}
            className="tf-themed-select-option tf-contract-columns-option flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs outline-none"
          >
            <span aria-hidden="true" className={`flex size-4 shrink-0 items-center justify-center rounded border ${checked ? "border-primary bg-primary text-white" : "border-slate-300 dark:border-slate-600"}`}>
              {checked && <span className="material-symbols-outlined text-[13px] font-bold">check</span>}
            </span>
            <span className="min-w-0 flex-1">{CONTRACT_OVERVIEW_PARAMETER_LABELS[key]}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => { if (open) close(); else setOpen(true); }}
        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-primary/45 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Sloupce ({visible.size})
      </button>
      {menu}
    </>
  );
};
