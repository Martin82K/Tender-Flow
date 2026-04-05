import type { View, ProjectTab } from "@/types";

export interface HelpEntry {
  /** Unique ID matching data-help-id on the DOM element */
  id: string;
  /** View this help entry belongs to */
  view: View;
  /** Optional tab within project view */
  tab?: ProjectTab;
  /** Short label (Czech) */
  label: string;
  /** Brief description shown in the bubble (Czech) */
  description: string;
  /** Detailed explanation, shown on expand (Czech) */
  detail?: string;
  /** Slug into user-manual knowledge base for "Více v příručce" link */
  manualAnchor?: string;
  /** Category for grouping */
  category?: "navigation" | "data-entry" | "action" | "info" | "data-flow";
  /** Tour order (lower = earlier). Undefined = excluded from tour */
  tourOrder?: number;
  /** Data-flow description with arrow targets */
  dataFlow?: { targetHelpId: string; label: string }[];
}

export interface DiscoveredElement {
  helpId: string;
  rect: DOMRect;
  element: HTMLElement;
}

export interface HelpContextValue {
  isActive: boolean;
  toggle: () => void;
  activate: () => void;
  deactivate: () => void;
  focusedEntry: HelpEntry | null;
  focusedElement: DiscoveredElement | null;
  setFocused: (entry: HelpEntry | null, element: DiscoveredElement | null) => void;
  currentEntries: HelpEntry[];
  discoveredElements: DiscoveredElement[];
  isTourActive: boolean;
  startTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  stopTour: () => void;
  tourStep: number;
  tourTotal: number;
}
