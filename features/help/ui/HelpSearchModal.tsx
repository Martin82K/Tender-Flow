import React, { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { searchEntries } from "../content/helpContent";
import type { HelpEntry } from "../types";
import { useHelp } from "../hooks/useHelp";

const categoryLabels: Record<string, string> = {
  navigation: "Navigace",
  "data-entry": "Zadávání dat",
  action: "Akce",
  info: "Informace",
  "data-flow": "Tok dat",
};

const viewLabels: Record<string, string> = {
  dashboard: "Command Center",
  project: "Projekt",
  contacts: "Kontakty",
  settings: "Nastavení",
  "project-management": "Správa staveb",
  "project-overview": "Přehledy",
  "url-shortener": "URL Zkracovač",
};

interface HelpSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpSearchModal: React.FC<HelpSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState("");
  const help = useHelp();

  const results = useMemo(() => {
    if (query.length < 2) return [];
    return searchEntries(query);
  }, [query]);

  const handleSelect = useCallback(
    (entry: HelpEntry) => {
      onClose();
      setQuery("");
      // Navigate to the entry's view and activate help
      help.activate();
      // Find the element and focus it after a short delay
      setTimeout(() => {
        const el = document.querySelector<HTMLElement>(`[data-help-id="${entry.id}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          const discovered = help.discoveredElements.find((d) => d.helpId === entry.id);
          if (discovered) {
            help.setFocused(entry, discovered);
          }
        }
      }, 300);
    },
    [help, onClose],
  );

  // ESC key closes search (with stopPropagation to prevent help mode from closing)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
        setQuery("");
      }
    };
    // Use capture phase to intercept before useHelpKeyboard
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
    setQuery("");
  };

  const modal = (
    <div className="fixed inset-0 z-[55] flex items-start justify-center pt-[15vh]" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden help-bubble-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Zpět na nápovědu"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat v nápovědě..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-white placeholder-slate-400"
            autoFocus
          />
          <button
            onClick={handleClose}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query.length < 2 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              Zadejte alespoň 2 znaky pro vyhledávání
            </div>
          ) : results.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              <span className="material-symbols-outlined text-3xl mb-2 block">search_off</span>
              Žádné výsledky pro "{query}"
            </div>
          ) : (
            <div className="py-2">
              {results.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => handleSelect(entry)}
                  className="w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex-shrink-0 text-primary/60 group-hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[18px]">help</span>
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {entry.label}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {entry.description}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {viewLabels[entry.view] || entry.view}
                        </span>
                        {entry.category && (
                          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                            {categoryLabels[entry.category]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
