import type { Project, ProjectDetails } from "@/types";
import { buildAppUrl } from "@shared/routing/routeUtils";
import type { Signal } from "@features/dashboard/model/signal";
import { dateDiffDays } from "@features/dashboard/model/utils/dates";

export function buildTenderEndingSignals(
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
      if (!category.realizationStart) continue;

      const daysUntilStart = dateDiffDays(category.realizationStart, today);
      if (daysUntilStart === null) continue;
      if (daysUntilStart < 0 || daysUntilStart > 14) continue;

      const bids = details.bids?.[category.id] ?? [];
      const hasWinner = bids.some((b) => b.status === "sod");
      if (hasWinner) continue;

      signals.push({
        id: `tender_ending_no_winner:${project.id}:${category.id}`,
        severity: "critical",
        kind: "tender_ending_no_winner",
        projectId: project.id,
        projectName: project.name,
        categoryId: category.id,
        title: `${category.title} — realizace za ${daysUntilStart} d bez vítěze`,
        description: `${project.name} · Status: ${category.status} · ${bids.length} nabídek`,
        dueDate: category.realizationStart,
        daysUntilDue: daysUntilStart,
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
