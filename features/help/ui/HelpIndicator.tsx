import React from "react";
import type { DiscoveredElement, HelpEntry } from "../types";

interface HelpIndicatorProps {
  discovered: DiscoveredElement;
  entry: HelpEntry;
  isFocused: boolean;
  index?: number;
  onClick: () => void;
}

const categoryIcons: Record<string, string> = {
  navigation: "explore",
  "data-entry": "edit_note",
  action: "touch_app",
  info: "info",
  "data-flow": "sync_alt",
};

/**
 * Check if an element is visible within all its scrollable ancestors.
 * Returns the visible bounding rect (clipped to scrollable parents) or null if hidden.
 */
function getVisibleRect(element: HTMLElement): DOMRect | null {
  const rect = element.getBoundingClientRect();

  // Start with viewport bounds
  let clipTop = 0;
  let clipLeft = 0;
  let clipRight = window.innerWidth;
  let clipBottom = window.innerHeight;

  // Walk up the DOM tree and intersect with each scrollable ancestor
  let parent = element.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    const overflowX = style.overflowX;
    const overflowY = style.overflowY;
    const isScrollable =
      overflowX === "auto" || overflowX === "scroll" || overflowX === "hidden" ||
      overflowY === "auto" || overflowY === "scroll" || overflowY === "hidden";

    if (isScrollable) {
      const parentRect = parent.getBoundingClientRect();
      clipTop = Math.max(clipTop, parentRect.top);
      clipLeft = Math.max(clipLeft, parentRect.left);
      clipRight = Math.min(clipRight, parentRect.right);
      clipBottom = Math.min(clipBottom, parentRect.bottom);
    }
    parent = parent.parentElement;
  }

  // Check if element is within the clipped area (with some margin)
  const margin = 20; // Allow indicator to show if at least 20px of element is visible
  if (
    rect.right < clipLeft + margin ||
    rect.left > clipRight - margin ||
    rect.bottom < clipTop + margin ||
    rect.top > clipBottom - margin
  ) {
    return null; // Element is not visible
  }

  return rect;
}

export const HelpIndicator: React.FC<HelpIndicatorProps> = ({
  discovered,
  entry,
  isFocused,
  index,
  onClick,
}) => {
  const icon = categoryIcons[entry.category || "info"] || "help";

  // Recalculate position from the live element and check visibility
  const visibleRect = getVisibleRect(discovered.element);
  if (!visibleRect) return null;

  // Position indicator at top-right corner of the element
  // Clamp to viewport so it doesn't go off-screen
  const indicatorSize = isFocused ? 32 : 28;
  const top = Math.max(4, Math.min(visibleRect.top - 8, window.innerHeight - indicatorSize - 4));
  const left = Math.max(4, Math.min(visibleRect.right - 8, window.innerWidth - indicatorSize - 4));

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`
        fixed flex items-center justify-center rounded-full pointer-events-auto cursor-pointer
        transition-all duration-200 z-[36]
        ${isFocused
          ? "w-8 h-8 bg-primary text-white shadow-lg shadow-primary/30 scale-110"
          : "w-7 h-7 bg-primary/90 text-white shadow-md shadow-primary/20 hover:scale-110 help-indicator-pulse"
        }
      `}
      style={{ top, left }}
      title={entry.label}
      aria-label={`Nápověda: ${entry.label}`}
    >
      {index != null ? (
        <span className="text-xs font-bold">{index + 1}</span>
      ) : (
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
      )}
    </button>
  );
};
