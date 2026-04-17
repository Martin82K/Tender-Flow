import type { Project, ProjectDetails } from "@/types";
import { buildAppUrl } from "@shared/routing/routeUtils";
import type { Signal, SignalKind, Severity } from "@features/dashboard/model/signal";
import { dateDiffDays } from "@features/dashboard/model/utils/dates";

function classify(daysUntilDue: number): { severity: Severity; kind: SignalKind; titleSuffix: string } | null {
  if (daysUntilDue < 0) {
    return {
      severity: "critical",
      kind: "deadline_overdue",
      titleSuffix: `termín po splatnosti (${Math.abs(daysUntilDue)} d)`,
    };
  }
  if (daysUntilDue <= 2) {
    return {
      severity: "critical",
      kind: "deadline_soon",
      titleSuffix: `termín za ${daysUntilDue} d`,
    };
  }
  if (daysUntilDue <= 7) {
    return {
      severity: "warning",
      kind: "deadline_soon",
      titleSuffix: `termín za ${daysUntilDue} d`,
    };
  }
  return null;
}

export function buildDeadlineSignals(
  projects: Project[],
  allProjectDetails: Record<string, ProjectDetails>,
  today: Date,
): Signal[] {
  const signals: Signal[] = [];

  for (const project of projects) {
    if (project.status === "archived") continue;
    const details = allProjectDetails[project.id];
    if (!details?.categories?.length) continue;

    for (const category of details.categories) {
      if (category.status === "sod" || category.status === "closed") continue;
      if (!category.deadline) continue;

      const daysUntilDue = dateDiffDays(category.deadline, today);
      if (daysUntilDue === null) continue;

      const classification = classify(daysUntilDue);
      if (!classification) continue;

      const { severity, kind, titleSuffix } = classification;

      signals.push({
        id: `${kind}:${project.id}:${category.id}`,
        severity,
        kind,
        projectId: project.id,
        projectName: project.name,
        categoryId: category.id,
        title: `${category.title} — ${titleSuffix}`,
        description: `${project.name} · Otevřená poptávka · ${category.subcontractorCount} dodavatelů`,
        dueDate: category.deadline,
        daysUntilDue,
        actionUrl: buildAppUrl("project", {
          projectId: project.id,
          tab: "pipeline",
          categoryId: category.id,
        }),
      });
    }
  }

  return signals;
}
