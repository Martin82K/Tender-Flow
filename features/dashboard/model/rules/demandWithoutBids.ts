import type { Project, ProjectDetails } from "@/types";
import { buildAppUrl } from "@shared/routing/routeUtils";
import type { Signal } from "@features/dashboard/model/signal";
import { dateDiffDays } from "@features/dashboard/model/utils/dates";

export function buildNoBidsSignals(
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
      if (category.status !== "open") continue;
      if (!category.createdAt) continue;

      const daysSinceCreated = dateDiffDays(today, category.createdAt);
      if (daysSinceCreated === null || daysSinceCreated < 14) continue;

      const bids = details.bids?.[category.id];
      if (bids && bids.length > 0) continue;

      const daysUntilDue =
        category.deadline != null ? dateDiffDays(category.deadline, today) ?? undefined : undefined;

      signals.push({
        id: `no_bids_14d:${project.id}:${category.id}`,
        severity: "warning",
        kind: "no_bids_14d",
        projectId: project.id,
        projectName: project.name,
        categoryId: category.id,
        title: `${category.title} — 14+ dní bez nabídek`,
        description: `${project.name} · Poptávka vytvořena před ${daysSinceCreated} dny`,
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
