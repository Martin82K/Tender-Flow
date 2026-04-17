import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useHelp } from "../hooks/useHelp";
import { useHelpDiscovery } from "../hooks/useHelpDiscovery";
import { useHelpKeyboard } from "../hooks/useHelpKeyboard";
import { HelpIndicator } from "./HelpIndicator";
import { HelpBubble } from "./HelpBubble";
import { HelpSearchModal } from "./HelpSearchModal";

export const HelpOverlay: React.FC = () => {
  const help = useHelp();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Activate DOM discovery when help mode is on
  useHelpDiscovery(help.isActive);

  // Keyboard shortcuts
  useHelpKeyboard(help);

  if (!help.isActive) return null;

  const handleIndicatorClick = (helpId: string) => {
    const entry = help.currentEntries.find((e) => e.id === helpId);
    const element = help.discoveredElements.find((d) => d.helpId === helpId);
    if (entry && element) {
      if (help.focusedEntry?.id === helpId) {
        help.setFocused(null, null);
      } else {
        help.setFocused(entry, element);
      }
    }
  };

  const handleBackdropClick = () => {
    if (help.focusedEntry) {
      help.setFocused(null, null);
    } else {
      help.deactivate();
    }
  };

  const overlay = (
    <div className="fixed inset-0 z-[35] help-overlay-enter" onClick={handleBackdropClick}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" />

      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-3 z-[38] pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-lg px-4 py-2">
          <span className="material-symbols-outlined text-primary text-[20px]">help</span>
          <span className="text-sm font-semibold text-slate-800 dark:text-white">
            Nápověda
          </span>
          <span className="hidden sm:inline text-xs text-slate-400 dark:text-slate-500">
            Klikněte na indikátor pro zobrazení popisu
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
            aria-label="Hledat v nápovědě"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
            <span className="hidden sm:inline text-xs">Hledat</span>
          </button>

          {/* Tour */}
          {help.tourTotal > 0 && !help.isTourActive && (
            <button
              onClick={help.startTour}
              className="flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-lg px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">tour</span>
              <span className="hidden sm:inline">Spustit prohlídku</span>
            </button>
          )}

          {/* Close */}
          <button
            onClick={help.deactivate}
            className="flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
            aria-label="Zavřít nápovědu"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>

      {/* Indicators */}
      {help.discoveredElements.map((discovered) => {
        const entry = help.currentEntries.find((e) => e.id === discovered.helpId);
        if (!entry) return null;

        const tourIdx = help.isTourActive
          ? help.currentEntries
              .filter((e) => e.tourOrder != null)
              .sort((a, b) => a.tourOrder! - b.tourOrder!)
              .findIndex((e) => e.id === entry.id)
          : undefined;

        return (
          <HelpIndicator
            key={discovered.helpId}
            discovered={discovered}
            entry={entry}
            isFocused={help.focusedEntry?.id === discovered.helpId}
            index={tourIdx != null && tourIdx >= 0 ? tourIdx : undefined}
            onClick={() => handleIndicatorClick(discovered.helpId)}
          />
        );
      })}

      {/* Bubble */}
      {help.focusedEntry && help.focusedElement && (
        <HelpBubble entry={help.focusedEntry} anchor={help.focusedElement} />
      )}

      {/* Search Modal */}
      <HelpSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );

  return createPortal(overlay, document.body);
};
