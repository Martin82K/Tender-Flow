import type { DemandCategory, TenderPlanItem } from "@/types";

export type TenderPlanViewMode = "all" | "active" | "closed" | "tools";

export interface TenderPlanStatus {
  label: string;
  color: "blue" | "emerald" | "slate" | "amber";
}

export interface ImportConflict {
  existingItem: TenderPlanItem;
  importItem: { name: string; dateFrom: string; dateTo: string };
  importKey: string;
}

export interface PlannedImportResult {
  rowsToCreate: Array<{ name: string; dateFrom: string; dateTo: string }>;
  conflicts: ImportConflict[];
  skipped: number;
}

export const normalizePlanNameKey = (value: string): string => value.trim().toLowerCase();

export const findLinkedCategoryForPlan = (
  item: TenderPlanItem,
  categories: DemandCategory[],
): DemandCategory | undefined => {
  return categories.find(
    (category) => category.title.toLowerCase() === item.name.toLowerCase(),
  );
};

export const getTenderPlanStatus = (
  item: TenderPlanItem,
  categories: DemandCategory[],
): TenderPlanStatus => {
  const category = findLinkedCategoryForPlan(item, categories);
  if (!category) {
    return { label: "Čeká na vytvoření", color: "slate" };
  }

  switch (category.status) {
    case "open":
      return { label: "Probíhá", color: "blue" };
    case "sod":
      return { label: "Zasmluvněno", color: "emerald" };
    case "closed":
      return { label: "Ukončeno", color: "slate" };
    default:
      return { label: "Aktivní", color: "amber" };
  }
};

export const getTenderPlanStatusBadgeClasses = (
  color: TenderPlanStatus["color"],
): string => {
  switch (color) {
    case "blue":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
    case "emerald":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
    case "amber":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
    default:
      return "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20";
  }
};

export const getVisibleTenderPlans = (
  items: TenderPlanItem[],
  categories: DemandCategory[],
  viewMode: TenderPlanViewMode,
): TenderPlanItem[] => {
  return [...items]
    .filter((item) => {
      if (viewMode === "all" || viewMode === "tools") return true;

      const status = getTenderPlanStatus(item, categories);
      if (viewMode === "closed") {
        return status.label === "Ukončeno" || status.label === "Zasmluvněno";
      }

      return status.label !== "Ukončeno" && status.label !== "Zasmluvněno";
    })
    .sort((a, b) => a.name.localeCompare(b.name, "cs"));
};

export const planTenderImport = (
  parsedItems: Array<{ name: string; dateFrom: string; dateTo: string }>,
  existingItems: TenderPlanItem[],
): PlannedImportResult => {
  const existingByName = new Map<string, TenderPlanItem>();
  existingItems.forEach((item) => {
    const key = normalizePlanNameKey(item.name);
    if (!existingByName.has(key)) {
      existingByName.set(key, item);
    }
  });

  const seenImportNames = new Set<string>();
  const rowsToCreate: Array<{ name: string; dateFrom: string; dateTo: string }> = [];
  const conflicts: ImportConflict[] = [];
  let skipped = 0;

  for (const item of parsedItems) {
    if (!item.name) {
      skipped++;
      continue;
    }

    const importName = item.name.trim();
    if (!importName) {
      skipped++;
      continue;
    }

    const importKey = normalizePlanNameKey(importName);
    if (seenImportNames.has(importKey)) {
      skipped++;
      continue;
    }
    seenImportNames.add(importKey);

    const existingMatch = existingByName.get(importKey);
    const nextFrom = (item.dateFrom || "").trim();
    const nextTo = (item.dateTo || "").trim();

    if (existingMatch) {
      const currentFrom = (existingMatch.dateFrom || "").trim();
      const currentTo = (existingMatch.dateTo || "").trim();
      const datesDiffer = currentFrom !== nextFrom || currentTo !== nextTo;

      if (datesDiffer) {
        conflicts.push({
          existingItem: existingMatch,
          importItem: { name: importName, dateFrom: nextFrom, dateTo: nextTo },
          importKey,
        });
      } else {
        skipped++;
      }
      continue;
    }

    rowsToCreate.push({ name: importName, dateFrom: nextFrom, dateTo: nextTo });
  }

  return { rowsToCreate, conflicts, skipped };
};

export const buildImportSummaryMessage = (stats: {
  imported: number;
  updated: number;
  skipped: number;
}) => {
  return `Nově přidáno: ${stats.imported}\nAktualizováno: ${stats.updated}\nPřeskočeno: ${stats.skipped}`;
};

export const buildConflictPromptMessage = (
  conflict: ImportConflict | undefined,
  remainingCount: number,
): string => {
  if (!conflict) return "";

  return (
    `Položka "${conflict.existingItem.name}" už v plánu existuje, ale liší se termíny.\n\n` +
    `Aktuální: ${conflict.existingItem.dateFrom || "—"} – ${conflict.existingItem.dateTo || "—"}\n` +
    `Import: ${conflict.importItem.dateFrom || "—"} – ${conflict.importItem.dateTo || "—"}\n\n` +
    `Chcete termíny aktualizovat?\n(Zbývá vyřešit: ${remainingCount})`
  );
};
