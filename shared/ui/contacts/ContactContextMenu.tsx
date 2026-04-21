import React, { useEffect, useRef } from "react";
import { Subcontractor } from "@/types";

export interface ContactContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  onSelect: (contact: Subcontractor) => void;
  danger?: boolean;
}

interface ContactContextMenuProps {
  contact: Subcontractor | null;
  position: { x: number; y: number } | null;
  items: ContactContextMenuItem[];
  onClose: () => void;
}

const MENU_WIDTH = 220;
const MENU_ITEM_HEIGHT = 40;
const MENU_VERTICAL_PADDING = 8;

export const ContactContextMenu: React.FC<ContactContextMenuProps> = ({
  contact,
  position,
  items,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return;
    const handlePointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleScroll = () => onClose();

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [position, onClose]);

  if (!position || !contact) return null;

  const menuHeight = items.length * MENU_ITEM_HEIGHT + MENU_VERTICAL_PADDING * 2;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
  const left = Math.min(position.x, Math.max(0, viewportWidth - MENU_WIDTH - 8));
  const top = Math.min(position.y, Math.max(0, viewportHeight - menuHeight - 8));

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Akce kontaktu"
      data-testid="contact-context-menu"
      className="fixed z-[60] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-2 animate-fade-in"
      style={{ left, top, width: MENU_WIDTH }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          role="menuitem"
          type="button"
          onClick={() => {
            item.onSelect(contact);
            onClose();
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
            item.danger
              ? "text-red-600 dark:text-red-400"
              : "text-slate-700 dark:text-slate-200"
          }`}
        >
          {item.icon && (
            <span className="material-symbols-outlined text-[18px]">
              {item.icon}
            </span>
          )}
          <span className="font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  );
};
