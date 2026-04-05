import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { HelpEntry, DiscoveredElement } from "../types";
import { useHelp } from "../hooks/useHelp";

interface HelpBubbleProps {
  entry: HelpEntry;
  anchor: DiscoveredElement;
}

const categoryLabels: Record<string, string> = {
  navigation: "Navigace",
  "data-entry": "Zadávání dat",
  action: "Akce",
  info: "Informace",
  "data-flow": "Tok dat",
};

const categoryIcons: Record<string, string> = {
  navigation: "explore",
  "data-entry": "edit_note",
  action: "touch_app",
  info: "info",
  "data-flow": "sync_alt",
};

type Placement = "top" | "bottom" | "left" | "right";

/**
 * Compute the indicator position (top-right corner of element, clamped to viewport).
 * This is where the small pulsing dot appears.
 */
function getIndicatorPos(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.max(4, Math.min(rect.right - 8, window.innerWidth - 32)),
    y: Math.max(4, Math.min(rect.top - 8, window.innerHeight - 32)),
  };
}

function computePlacement(indicatorPos: { x: number; y: number }, bubbleWidth: number, bubbleHeight: number): { placement: Placement; top: number; left: number } {
  const gap = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Treat indicator as a small 28x28 rect
  const indSize = 28;
  const indTop = indicatorPos.y;
  const indLeft = indicatorPos.x;
  const indBottom = indTop + indSize;
  const indRight = indLeft + indSize;
  const indCenterX = indLeft + indSize / 2;
  const indCenterY = indTop + indSize / 2;

  const spaceBelow = vh - indBottom;
  const spaceAbove = indTop;
  const spaceRight = vw - indRight;
  const spaceLeft = indLeft;

  // Prefer below indicator, then above, then left, then right
  if (spaceBelow >= bubbleHeight + gap) {
    return {
      placement: "bottom",
      top: indBottom + gap,
      left: Math.max(12, Math.min(indCenterX - bubbleWidth / 2, vw - bubbleWidth - 12)),
    };
  }
  if (spaceAbove >= bubbleHeight + gap) {
    return {
      placement: "top",
      top: indTop - bubbleHeight - gap,
      left: Math.max(12, Math.min(indCenterX - bubbleWidth / 2, vw - bubbleWidth - 12)),
    };
  }
  if (spaceLeft >= bubbleWidth + gap) {
    return {
      placement: "left",
      top: Math.max(12, Math.min(indCenterY - bubbleHeight / 2, vh - bubbleHeight - 12)),
      left: indLeft - bubbleWidth - gap,
    };
  }
  if (spaceRight >= bubbleWidth + gap) {
    return {
      placement: "right",
      top: Math.max(12, Math.min(indCenterY - bubbleHeight / 2, vh - bubbleHeight - 12)),
      left: indRight + gap,
    };
  }
  // Fallback: center on screen
  return {
    placement: "bottom",
    top: Math.max(12, (vh - bubbleHeight) / 2),
    left: Math.max(12, (vw - bubbleWidth) / 2),
  };
}

export const HelpBubble: React.FC<HelpBubbleProps> = ({ entry, anchor }) => {
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const bubbleRef = useRef<HTMLDivElement>(null);
  const help = useHelp();

  const recalc = useCallback(() => {
    const indPos = getIndicatorPos(anchor.element);
    const bw = 340;
    const bh = expanded ? 280 : 180;
    const { top, left } = computePlacement(indPos, bw, bh);
    setPosition({ top, left });
  }, [anchor, expanded]);

  useEffect(() => {
    recalc();
  }, [recalc]);

  // Recalculate on scroll/resize
  useEffect(() => {
    window.addEventListener("scroll", recalc, true);
    window.addEventListener("resize", recalc);
    return () => {
      window.removeEventListener("scroll", recalc, true);
      window.removeEventListener("resize", recalc);
    };
  }, [recalc]);

  const category = entry.category || "info";

  const bubble = (
    <div
      ref={bubbleRef}
      className="fixed z-[37] w-[340px] help-bubble-enter pointer-events-auto"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary">
            <span className="material-symbols-outlined text-[16px]">
              {categoryIcons[category]}
            </span>
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {entry.label}
            </h3>
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {categoryLabels[category]}
            </span>
          </div>
          <button
            onClick={() => help.setFocused(null, null)}
            className="flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Zavřít"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-2">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {entry.description}
          </p>

          {entry.detail && (
            <>
              {expanded && (
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-1 border-t border-slate-100 dark:border-slate-800">
                  {entry.detail}
                </p>
              )}
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {expanded ? "Skrýt detail" : "Zobrazit více"}
              </button>
            </>
          )}

          {entry.dataFlow && entry.dataFlow.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                Tok dat
              </p>
              {entry.dataFlow.map((flow) => (
                <div key={flow.targetHelpId} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined text-[14px] text-primary">arrow_forward</span>
                  {flow.label}
                </div>
              ))}
            </div>
          )}

          {entry.manualAnchor && (
            <a
              href={`/user-manual/index.html#${entry.manualAnchor}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary/70 hover:text-primary transition-colors pt-1"
            >
              <span className="material-symbols-outlined text-[14px]">menu_book</span>
              Více v příručce
            </a>
          )}
        </div>

        {/* Footer — tour controls */}
        {help.isTourActive && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              {help.tourStep + 1} z {help.tourTotal}
            </span>
            <div className="flex items-center gap-2">
              {help.tourStep > 0 && (
                <button
                  onClick={help.prevTourStep}
                  className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  Předchozí
                </button>
              )}
              <button
                onClick={help.tourStep + 1 >= help.tourTotal ? help.stopTour : help.nextTourStep}
                className="px-3 py-1 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                {help.tourStep + 1 >= help.tourTotal ? "Dokončit" : "Další"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(bubble, document.body);
};
