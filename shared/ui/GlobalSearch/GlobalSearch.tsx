import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "@/shared/routing/router";
import { buildAppUrl } from "@/shared/routing/routeUtils";
import { useGlobalSearch } from "./useGlobalSearch";
import { useGlobalSearchContext } from "./GlobalSearchContext";
import { SearchResultsList } from "./SearchResultsList";
import { MIN_QUERY_LENGTH } from "./searchEngine";
import type { SearchResult } from "./types";

export interface GlobalSearchProps {
  placeholder?: string;
  autoFocus?: boolean;
  /** Close callback (used by modal) */
  onDismiss?: () => void;
  variant: "dropdown" | "modal";
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const LISTBOX_ID = "gs-listbox";

/**
 * Core controlled search widget: renders input + a panel of results.
 * Panel visibility is controlled by `isOpen`. In "dropdown" variant the
 * panel is absolutely positioned below the input; in "modal" the panel is
 * rendered inline inside a full-screen overlay (wrapper handles overlay).
 */
export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  placeholder = "Hledat projekty, kontakty, poptávky…",
  autoFocus = false,
  onDismiss,
  variant,
  isOpen,
  onOpenChange,
}) => {
  const ctx = useGlobalSearchContext();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const sources = ctx?.sources ?? { projects: [], contacts: [], projectDetails: {} };
  const {
    results,
    flatResults,
    isQueryTooShort,
    hasQuery,
    totalProjectCount,
    loadedProjectDetailsCount,
  } = useGlobalSearch(query, sources);

  useEffect(() => {
    setActiveIndex(0);
  }, [flatResults.length, query]);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      const { view, projectId, tab, categoryId } = result.navigateTo;
      navigate(
        buildAppUrl(view as any, {
          projectId,
          tab: tab as any,
          categoryId: categoryId ?? null,
        }),
      );
      setQuery("");
      onOpenChange(false);
      onDismiss?.();
    },
    [onOpenChange, onDismiss],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        if (flatResults.length === 0) return;
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % flatResults.length);
      } else if (e.key === "ArrowUp") {
        if (flatResults.length === 0) return;
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + flatResults.length) % flatResults.length);
      } else if (e.key === "Enter") {
        if (flatResults.length === 0) return;
        e.preventDefault();
        const selected = flatResults[activeIndex];
        if (selected) handleSelect(selected);
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (query) {
          setQuery("");
        } else {
          onOpenChange(false);
          onDismiss?.();
          inputRef.current?.blur();
        }
      }
    },
    [flatResults, activeIndex, handleSelect, query, onOpenChange, onDismiss],
  );

  const activeDescendant = useMemo(
    () => (flatResults.length > 0 && isOpen ? `gs-option-${activeIndex}` : undefined),
    [flatResults.length, isOpen, activeIndex],
  );

  const showEmpty = isOpen && hasQuery && !isQueryTooShort && results.length === 0;
  const showTooShort = isOpen && isQueryTooShort;
  const showHint = isOpen && !hasQuery;
  const projectsCoveragePartial =
    totalProjectCount > 0 && loadedProjectDetailsCount < totalProjectCount;

  const panel = isOpen ? (
    <>
      {showHint && (
        <div className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
          Začněte psát — hledá se v projektech, kontaktech a poptávkách.
          <div className="mt-2 text-[10px] opacity-70">
            <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600">↑</kbd>
            <kbd className="ml-1 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600">↓</kbd>
            <span className="mx-1.5">navigace</span>
            <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600">Enter</kbd>
            <span className="mx-1.5">vybrat</span>
            <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600">Esc</kbd>
            <span className="mx-1.5">zavřít</span>
          </div>
        </div>
      )}
      {showTooShort && (
        <div className="px-4 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
          Zadejte alespoň {MIN_QUERY_LENGTH} znaky…
        </div>
      )}
      {showEmpty && (
        <div className="px-4 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
          Žádné výsledky pro „{query}".
          {projectsCoveragePartial && (
            <div className="mt-1 text-[10px] opacity-80">
              Prohledáno {loadedProjectDetailsCount} z {totalProjectCount} projektů.
            </div>
          )}
        </div>
      )}
      {results.length > 0 && (
        <>
          <SearchResultsList
            groups={results}
            query={query}
            activeIndex={activeIndex}
            onSelect={handleSelect}
            onHover={setActiveIndex}
            listboxId={LISTBOX_ID}
          />
          {projectsCoveragePartial && (
            <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500">
              Prohledáno {loadedProjectDetailsCount} z {totalProjectCount} projektů
              (poptávky jen z otevřených).
            </div>
          )}
        </>
      )}
    </>
  ) : null;

  if (variant === "modal") {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 px-4 border-b border-slate-200 dark:border-slate-700/60">
          <span className="material-symbols-outlined text-slate-400 dark:text-slate-500">
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length > 0 && !isOpen) onOpenChange(true);
            }}
            onFocus={() => onOpenChange(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={LISTBOX_ID}
            aria-activedescendant={activeDescendant}
            autoComplete="off"
            className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-base text-slate-900 dark:text-white placeholder-slate-400 py-4 px-2"
          />
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onDismiss?.();
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Zavřít"
          >
            <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-[10px] font-mono">
              Esc
            </kbd>
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">{panel}</div>
      </div>
    );
  }

  // dropdown variant — panel floats below input
  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value.trim().length > 0) onOpenChange(true);
        }}
        onFocus={() => {
          if (query.trim().length >= MIN_QUERY_LENGTH) onOpenChange(true);
          else onOpenChange(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={LISTBOX_ID}
        aria-activedescendant={activeDescendant}
        autoComplete="off"
        className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400/70"
      />
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-[28rem] max-h-[28rem] overflow-y-auto z-50 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
          {panel}
        </div>
      )}
    </div>
  );
};
