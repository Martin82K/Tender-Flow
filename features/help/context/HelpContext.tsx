import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useLocation } from "@shared/routing/router";
import type { HelpEntry, DiscoveredElement, HelpContextValue } from "../types";
import type { View, ProjectTab } from "@/types";
import { getEntriesForView } from "../content/helpContent";
import { useToast } from "@features/notifications/context/ToastContext";

const HELP_SEEN_KEY = "tf_help_seen";

function getSeenViews(): Set<string> {
  try {
    const raw = localStorage.getItem(HELP_SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markViewSeen(view: string) {
  const seen = getSeenViews();
  seen.add(view);
  localStorage.setItem(HELP_SEEN_KEY, JSON.stringify([...seen]));
}

const HelpContext = createContext<HelpContextValue | null>(null);

function parseViewFromPath(pathname: string): { view: View | null; tab: ProjectTab | null } {
  const parts = pathname.replace(/^\/app\/?/, "").split("/");
  const segment = parts[0] || "command-center";

  const viewMap: Record<string, View> = {
    "command-center": "command-center",
    project: "project",
    contacts: "contacts",
    settings: "settings",
    "project-management": "project-management",
    "project-overview": "project-overview",
    "url-shortener": "url-shortener",
  };

  const view = viewMap[segment] || null;
  return { view, tab: null };
}

function parseTabFromSearch(search: string): ProjectTab | null {
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  if (tab && ["overview", "tender-plan", "pipeline", "schedule", "documents", "contracts"].includes(tab)) {
    return tab as ProjectTab;
  }
  return null;
}

export const HelpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [isActive, setIsActive] = useState(false);
  const [focusedEntry, setFocusedEntry] = useState<HelpEntry | null>(null);
  const [focusedElement, setFocusedElement] = useState<DiscoveredElement | null>(null);
  const [discoveredElements, setDiscoveredElements] = useState<DiscoveredElement[]>([]);
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const { view } = parseViewFromPath(location.pathname);
  const tab = view === "project" ? parseTabFromSearch(location.search) : null;

  const currentEntries = useMemo(() => {
    if (!view) return [];
    return getEntriesForView(view, tab);
  }, [view, tab]);

  const tourEntries = useMemo(
    () => currentEntries
      .filter((e) => e.tourOrder != null && discoveredElements.some((d) => d.helpId === e.id))
      .sort((a, b) => a.tourOrder! - b.tourOrder!),
    [currentEntries, discoveredElements],
  );

  const toggle = useCallback(() => {
    setIsActive((prev) => {
      if (prev) {
        setFocusedEntry(null);
        setFocusedElement(null);
        setIsTourActive(false);
        setTourStep(0);
      }
      return !prev;
    });
  }, []);

  const activate = useCallback(() => setIsActive(true), []);

  const deactivate = useCallback(() => {
    setIsActive(false);
    setFocusedEntry(null);
    setFocusedElement(null);
    setIsTourActive(false);
    setTourStep(0);
  }, []);

  const setFocused = useCallback((entry: HelpEntry | null, element: DiscoveredElement | null) => {
    setFocusedEntry(entry);
    setFocusedElement(element);
  }, []);

  const startTour = useCallback(() => {
    if (tourEntries.length === 0) return;
    setIsTourActive(true);
    setTourStep(0);
    const first = tourEntries[0];
    const el = discoveredElements.find((d) => d.helpId === first.id);
    setFocusedEntry(first);
    setFocusedElement(el || null);
    el?.element.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [tourEntries, discoveredElements]);

  const nextTourStep = useCallback(() => {
    const next = tourStep + 1;
    if (next >= tourEntries.length) {
      setIsTourActive(false);
      setTourStep(0);
      setFocusedEntry(null);
      setFocusedElement(null);
      return;
    }
    setTourStep(next);
    const entry = tourEntries[next];
    const el = discoveredElements.find((d) => d.helpId === entry.id);
    setFocusedEntry(entry);
    setFocusedElement(el || null);
    el?.element.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [tourStep, tourEntries, discoveredElements]);

  const prevTourStep = useCallback(() => {
    const prev = Math.max(0, tourStep - 1);
    setTourStep(prev);
    const entry = tourEntries[prev];
    const el = discoveredElements.find((d) => d.helpId === entry.id);
    setFocusedEntry(entry);
    setFocusedElement(el || null);
    el?.element.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [tourStep, tourEntries, discoveredElements]);

  const stopTour = useCallback(() => {
    setIsTourActive(false);
    setTourStep(0);
    setFocusedEntry(null);
    setFocusedElement(null);
  }, []);

  const value = useMemo<HelpContextValue>(
    () => ({
      isActive,
      toggle,
      activate,
      deactivate,
      focusedEntry,
      focusedElement,
      setFocused,
      currentEntries,
      discoveredElements,
      isTourActive,
      startTour,
      nextTourStep,
      prevTourStep,
      stopTour,
      tourStep,
      tourTotal: tourEntries.length,
    }),
    [
      isActive, toggle, activate, deactivate, focusedEntry, focusedElement,
      setFocused, currentEntries, discoveredElements, isTourActive, startTour,
      nextTourStep, prevTourStep, stopTour, tourStep, tourEntries.length,
    ],
  );

  // Mark view as seen when help is used
  useEffect(() => {
    if (isActive && view) {
      markViewSeen(view);
    }
  }, [isActive, view]);

  // First-time hint: show a toast once when user first visits a view with help content
  const toast = useToast();
  const hintShownRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!view || isActive) return;
    const seenViews = getSeenViews();
    if (seenViews.has(view) || hintShownRef.current.has(view)) return;
    if (currentEntries.length === 0) return;

    hintShownRef.current.add(view);
    markViewSeen(view);
    const timer = setTimeout(() => {
      toast.showToast({
        type: "info",
        title: "Nápověda k dispozici",
        body: "Stiskněte ? v pravém horním rohu nebo F1 pro zobrazení nápovědy k této stránce.",
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [view, isActive, currentEntries.length, toast]);

  // Expose setDiscoveredElements for the discovery hook
  return (
    <HelpContext.Provider value={value}>
      <HelpDiscoveryContext.Provider value={setDiscoveredElements}>
        {children}
      </HelpDiscoveryContext.Provider>
    </HelpContext.Provider>
  );
};

// Internal context for discovery hook to push elements
export const HelpDiscoveryContext = createContext<React.Dispatch<React.SetStateAction<DiscoveredElement[]>>>(() => {});

export function useHelp(): HelpContextValue {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error("useHelp must be used within HelpProvider");
  return ctx;
}

export function useHelpDiscoverySetter() {
  return useContext(HelpDiscoveryContext);
}
