import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { PipelineBulkEmailKind } from "@/features/projects/model/pipelineEmailModel";

interface PipelineBulkEmailMenuProps {
  inquiryRecipientCount: number;
  loserRecipientCount: number;
  onSelect: (kind: PipelineBulkEmailKind) => void;
}

interface MenuItem {
  kind: PipelineBulkEmailKind;
  label: string;
  description: string;
  icon: string;
  count: number;
  tooltip: string;
  tone: "emerald" | "blue" | "orange";
}

const toneClasses: Record<MenuItem["tone"], string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
  orange: "text-orange-600 dark:text-orange-400",
};

const MENU_MARGIN_PX = 8;
const MENU_WIDTH_PX = 320;

export const PipelineBulkEmailMenu: React.FC<
  PipelineBulkEmailMenuProps
> = ({ inquiryRecipientCount, loserRecipientCount, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const items: MenuItem[] = [
    {
      kind: "inquiry",
      label: "Standardní poptávka",
      description: "Dodavatelům ve sloupci Oslovení",
      icon: "mail",
      count: inquiryRecipientCount,
      tooltip: "Připravit standardní poptávku všem dodavatelům v Oslovení",
      tone: "emerald",
    },
    {
      kind: "materialInquiry",
      label: "Materiálová poptávka",
      description: "Dodavatelům ve sloupci Oslovení",
      icon: "inventory_2",
      count: inquiryRecipientCount,
      tooltip: "Připravit materiálovou poptávku všem dodavatelům v Oslovení",
      tone: "blue",
    },
    {
      kind: "losers",
      label: "Poděkování nevybraným",
      description: "Účastníkům s cenovou nabídkou",
      icon: "waving_hand",
      count: loserRecipientCount,
      tooltip: "Připravit poděkování nevybraným účastníkům s cenovou nabídkou",
      tone: "orange",
    },
  ];

  const closeMenu = (restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    };
    const handleViewportChange = () => closeMenu();

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    itemRefs.current[0]?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen]);

  const openMenu = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = Math.min(
      MENU_WIDTH_PX,
      Math.max(0, window.innerWidth - MENU_MARGIN_PX * 2),
    );
    const maximumLeft = Math.max(
      MENU_MARGIN_PX,
      window.innerWidth - menuWidth - MENU_MARGIN_PX,
    );
    setPosition({
      top: rect.bottom + MENU_MARGIN_PX,
      left: Math.min(
        Math.max(MENU_MARGIN_PX, rect.right - menuWidth),
        maximumLeft,
      ),
    });
    setIsOpen(true);
  };

  const handleMenuKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const currentIndex = itemRefs.current.findIndex(
      (item) => item === document.activeElement,
    );
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + direction + items.length) % items.length;
    itemRefs.current[nextIndex]?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        data-help-id="pipeline-bulk-email-trigger"
        type="button"
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        className="order-first flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-4 py-2 rounded-lg text-sm font-bold transition-colors md:order-none"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? "pipeline-bulk-email-menu" : undefined}
        title="Otevřít nabídku hromadných e-mailů"
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          mail
        </span>
        <span>Hromadný e-mail</span>
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
          expand_more
        </span>
      </button>

      {isOpen
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[9998] cursor-default bg-transparent"
                aria-label="Zavřít nabídku hromadných e-mailů"
                onClick={() => closeMenu(true)}
              />
              <div
                id="pipeline-bulk-email-menu"
                data-help-id="pipeline-bulk-email-menu"
                role="menu"
                aria-label="Hromadné e-maily"
                className="tf-pipeline-popover fixed z-[9999] w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
                style={{ top: position.top, left: position.left }}
                onKeyDown={handleMenuKeyDown}
              >
                {items.map((item, index) => (
                  <button
                    key={item.kind}
                    ref={(element) => {
                      itemRefs.current[index] = element;
                    }}
                    type="button"
                    role="menuitem"
                    data-help-id="pipeline-popover-item"
                    title={item.tooltip}
                    onClick={() => {
                      closeMenu();
                      onSelect(item.kind);
                    }}
                    className="tf-pipeline-popover-item flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none dark:border-slate-700 dark:hover:bg-slate-700 dark:focus-visible:bg-slate-700"
                  >
                    <span
                      className={`tf-pipeline-popover-icon material-symbols-outlined text-[20px] ${toneClasses[item.tone]}`}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="tf-pipeline-popover-label block text-sm font-semibold text-slate-900 dark:text-white">
                        {item.label}
                      </span>
                      <span className="tf-pipeline-popover-description block text-xs text-slate-500 dark:text-slate-400">
                        {item.description}
                      </span>
                    </span>
                    <span className="tf-pipeline-popover-count rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
};
