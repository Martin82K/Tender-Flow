import { useMemo } from "react";
import { useAppData } from "@/hooks/useAppData";
import { useUI } from "@/context/UIContext";
import type { CommandCenterFilterState } from "@features/command-center/types";
import { matchesFilter } from "./filterUtils";

export interface MatrixColumn {
  key: string;
  label: string;
}

export interface MatrixCell {
  tone: "ok" | "warn" | "crit" | "new" | "done" | "empty";
  primary: string;
  secondary?: string;
}

export interface MatrixRow {
  projectId: string;
  projectName: string;
  meta?: string;
  cells: Record<string, MatrixCell>;
}

export interface MatrixData {
  columns: MatrixColumn[];
  rows: MatrixRow[];
}

const MIN_SUPPLIERS = 3;

const toneForCategory = (
  categoryStatus: string,
  bidsCount: number,
  isBlocked: boolean,
  overdue: boolean
): MatrixCell["tone"] => {
  if (categoryStatus === "sod" || categoryStatus === "closed") return "done";
  if (isBlocked || overdue) return "crit";
  if (bidsCount === 0) return "new";
  if (bidsCount < MIN_SUPPLIERS) return "warn";
  return "ok";
};

export const useMatrixHealthData = (filter: CommandCenterFilterState): MatrixData => {
  const { showUiModal } = useUI();
  const { state } = useAppData(showUiModal);
  const { projects, allProjectDetails } = state;

  return useMemo(() => {
    const columnsMap = new Map<string, MatrixColumn>();
    const rows: MatrixRow[] = [];
    const now = Date.now();

    for (const project of projects) {
      if (project.status === "archived") continue;
      if (!matchesFilter(project, filter)) continue;
      const details = allProjectDetails[project.id];
      if (!details) continue;

      const cells: Record<string, MatrixCell> = {};
      for (const cat of details.categories ?? []) {
        const key = cat.title.toLowerCase().replace(/\s+/g, "-").slice(0, 40);
        if (!columnsMap.has(key)) {
          columnsMap.set(key, { key, label: cat.title.slice(0, 14) });
        }
        const bids = details.bids?.[cat.id] ?? [];
        const createdAt = cat.createdAt ? new Date(cat.createdAt).getTime() : null;
        const overdue =
          !!createdAt &&
          cat.status !== "closed" &&
          cat.status !== "sod" &&
          now - createdAt > 14 * 24 * 60 * 60 * 1000;
        const isBlocked =
          (!cat.documents || cat.documents.length === 0) &&
          !!createdAt &&
          now - createdAt > 2 * 24 * 60 * 60 * 1000 &&
          cat.status !== "closed" &&
          cat.status !== "sod";

        cells[key] = {
          tone: toneForCategory(cat.status, bids.length, isBlocked, overdue),
          primary: `${bids.length}`,
          secondary: cat.status === "sod" ? "SoD" : cat.status === "closed" ? "uzavř." : undefined,
        };
      }

      rows.push({
        projectId: project.id,
        projectName: project.name.slice(0, 18),
        meta: details?.categories?.length
          ? `${details.categories.length} kat.`
          : undefined,
        cells,
      });
    }

    const columns = Array.from(columnsMap.values()).slice(0, 6);
    return { columns, rows };
  }, [projects, allProjectDetails, filter]);
};
