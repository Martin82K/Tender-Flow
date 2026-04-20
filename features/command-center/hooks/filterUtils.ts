import type { Project, ProjectDetails } from "@/types";
import type { CommandCenterFilterState } from "@features/command-center/types";

export const matchesFilter = (project: Project, filter: CommandCenterFilterState): boolean => {
  if (filter.projectIds.length > 0 && !filter.projectIds.includes(project.id)) {
    return false;
  }
  if (filter.statuses.length > 0 && !filter.statuses.includes(project.status)) {
    return false;
  }
  return true;
};

export interface ProjectHealth {
  level: "ok" | "warn" | "crit";
  coveragePct: number;
  overBudget: boolean;
  blocked: boolean;
  overdue14d: boolean;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MIN_SUPPLIERS = 3;

export const computeProjectHealth = (
  project: Project,
  details: ProjectDetails | undefined,
  now: Date = new Date()
): ProjectHealth => {
  const categories = details?.categories ?? [];
  if (categories.length === 0) {
    return { level: "warn", coveragePct: 0, overBudget: false, blocked: false, overdue14d: false };
  }

  let coveredCount = 0;
  let overdue = false;
  let blocked = false;
  let budgetTotal = 0;
  let estimate = 0;

  for (const cat of categories) {
    const bids = details?.bids?.[cat.id] ?? [];
    if (bids.length >= MIN_SUPPLIERS || cat.status === "sod" || cat.status === "closed") {
      coveredCount += 1;
    }
    const createdAt = cat.createdAt ? new Date(cat.createdAt) : null;
    if (
      createdAt &&
      cat.status !== "closed" &&
      cat.status !== "sod" &&
      now.getTime() - createdAt.getTime() > 14 * MS_PER_DAY
    ) {
      overdue = true;
    }
    if (
      (!cat.documents || cat.documents.length === 0) &&
      createdAt &&
      now.getTime() - createdAt.getTime() > 2 * MS_PER_DAY &&
      cat.status !== "closed" &&
      cat.status !== "sod"
    ) {
      blocked = true;
    }
    budgetTotal += cat.sodBudget || cat.planBudget || 0;
    const winner = bids.find((b) => b.status === "sod") ?? bids.find((b) => b.status === "shortlist");
    const priceStr = winner?.price;
    if (priceStr) {
      const parsed = parseInt(priceStr.replace(/[^0-9]/g, ""), 10);
      if (Number.isFinite(parsed)) estimate += parsed;
    } else {
      estimate += cat.planBudget || 0;
    }
  }

  const coveragePct = Math.round((coveredCount / categories.length) * 100);
  const overBudget = budgetTotal > 0 && estimate > budgetTotal * 1.05;

  let level: "ok" | "warn" | "crit";
  if (blocked || overdue || overBudget || coveragePct < 70) {
    level = "crit";
  } else if (coveragePct < 95) {
    level = "warn";
  } else {
    level = "ok";
  }

  return { level, coveragePct, overBudget, blocked, overdue14d: overdue };
};

export const matchesHealthFilter = (
  health: "ok" | "warn" | "crit",
  filter: CommandCenterFilterState
): boolean => {
  if (filter.healthLevels.length === 0) return true;
  return filter.healthLevels.includes(health);
};
