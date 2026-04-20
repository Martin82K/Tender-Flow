import type { View, ProjectTab } from "@/types";
import type { HelpEntry } from "../types";
import { projectHelp } from "./project";
import { contactsHelp } from "./contacts";
import { projectManagerHelp } from "./projectManager";
import { projectOverviewHelp } from "./projectOverview";
import { settingsHelp } from "./settings";

const ALL_ENTRIES: HelpEntry[] = [
  ...projectHelp,
  ...contactsHelp,
  ...projectManagerHelp,
  ...projectOverviewHelp,
  ...settingsHelp,
];

export function getEntriesForView(view: View, tab?: ProjectTab | null): HelpEntry[] {
  return ALL_ENTRIES.filter(
    (e) => e.view === view && (!tab || !e.tab || e.tab === tab),
  );
}

export function getAllEntries(): HelpEntry[] {
  return ALL_ENTRIES;
}

export function getEntryById(id: string): HelpEntry | undefined {
  return ALL_ENTRIES.find((e) => e.id === id);
}

export function searchEntries(query: string): HelpEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return ALL_ENTRIES.filter(
    (e) =>
      e.label.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      (e.detail && e.detail.toLowerCase().includes(q)),
  );
}
