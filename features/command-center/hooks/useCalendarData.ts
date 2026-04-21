import { useMemo } from "react";
import { useAppData } from "@/hooks/useAppData";
import { useUI } from "@/context/UIContext";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { listTasks } from "@features/tasks/api/tasksApi";
import { TASK_KEYS } from "@features/tasks/hooks/useTasksQuery";
import { buildAppUrl } from "@shared/routing/routeUtils";
import type { CommandCenterFilterState } from "@features/command-center/types";
import type { Task } from "@features/tasks/types";
import { matchesFilter } from "./filterUtils";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEMAND_LIMIT_DAYS = 14;

export type CalendarEventKind =
  | "task"
  | "demand-deadline"
  | "demand-14d"
  | "realization-start"
  | "realization-end";

export type CalendarEventTone = "red" | "amber" | "blue" | "green" | "purple";

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  tone: CalendarEventTone;
  title: string;
  subtitle?: string;
  date: string;
  timestamp: number;
  projectId?: string;
  projectName?: string;
  actionUrl?: string;
  sourceTask?: Task;
}

const toDate = (value?: string): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const startOfDay = (d: Date): Date => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

export const useCalendarData = (filter: CommandCenterFilterState): CalendarEvent[] => {
  const { showUiModal } = useUI();
  const { state } = useAppData(showUiModal);
  const { user } = useAuth();
  const { projects, allProjectDetails } = state;

  const tasksQuery = useQuery({
    queryKey: TASK_KEYS.list(user?.id, { completed: false }),
    enabled: !!user && user.role !== "demo",
    queryFn: () => listTasks(user!.id, { completed: false }),
    staleTime: 60 * 1000,
  });

  return useMemo(() => {
    const events: CalendarEvent[] = [];
    const today = startOfDay(new Date());
    const horizon = new Date(today.getTime() + 60 * MS_PER_DAY);

    const projectNames: Record<string, string> = {};
    for (const p of projects) projectNames[p.id] = p.name;

    for (const task of tasksQuery.data ?? []) {
      if (task.completed) continue;
      const due = toDate(task.dueAt);
      if (!due) continue;
      if (due > horizon) continue;
      events.push({
        id: `task-${task.id}`,
        kind: "task",
        tone: "purple",
        title: task.title,
        subtitle: task.projectId ? projectNames[task.projectId] : undefined,
        date: due.toISOString(),
        timestamp: due.getTime(),
        projectId: task.projectId,
        projectName: task.projectId ? projectNames[task.projectId] : undefined,
        sourceTask: task,
      });
    }

    for (const project of projects) {
      if (project.status === "archived") continue;
      if (!matchesFilter(project, filter)) continue;
      const details = allProjectDetails[project.id];
      if (!details) continue;

      for (const category of details.categories ?? []) {
        const deadline = toDate(category.deadline);
        if (deadline && deadline <= horizon && deadline >= new Date(today.getTime() - 7 * MS_PER_DAY)) {
          events.push({
            id: `deadline-${category.id}`,
            kind: "demand-deadline",
            tone: "red",
            title: `Termín nabídky: ${category.title}`,
            subtitle: project.name,
            date: deadline.toISOString(),
            timestamp: deadline.getTime(),
            projectId: project.id,
            projectName: project.name,
            actionUrl: buildAppUrl("project", {
              projectId: project.id,
              tab: "pipeline",
              categoryId: category.id,
            }),
          });
        }

        const createdAt = toDate(category.createdAt);
        if (
          createdAt &&
          category.status !== "closed" &&
          category.status !== "sod"
        ) {
          const limitAt = new Date(createdAt.getTime() + DEMAND_LIMIT_DAYS * MS_PER_DAY);
          if (limitAt <= horizon && limitAt >= new Date(today.getTime() - 14 * MS_PER_DAY)) {
            events.push({
              id: `demand-14d-${category.id}`,
              kind: "demand-14d",
              tone: "amber",
              title: `14denní limit: ${category.title}`,
              subtitle: project.name,
              date: limitAt.toISOString(),
              timestamp: limitAt.getTime(),
              projectId: project.id,
              projectName: project.name,
              actionUrl: buildAppUrl("project", {
                projectId: project.id,
                tab: "pipeline",
                categoryId: category.id,
              }),
            });
          }
        }

        const realStart = toDate(category.realizationStart);
        if (realStart && realStart >= today && realStart <= horizon) {
          events.push({
            id: `real-start-${category.id}`,
            kind: "realization-start",
            tone: "blue",
            title: `Start realizace: ${category.title}`,
            subtitle: project.name,
            date: realStart.toISOString(),
            timestamp: realStart.getTime(),
            projectId: project.id,
            projectName: project.name,
            actionUrl: buildAppUrl("project", {
              projectId: project.id,
              tab: "schedule",
            }),
          });
        }

        const realEnd = toDate(category.realizationEnd);
        if (realEnd && realEnd >= today && realEnd <= horizon) {
          events.push({
            id: `real-end-${category.id}`,
            kind: "realization-end",
            tone: "green",
            title: `Konec realizace: ${category.title}`,
            subtitle: project.name,
            date: realEnd.toISOString(),
            timestamp: realEnd.getTime(),
            projectId: project.id,
            projectName: project.name,
            actionUrl: buildAppUrl("project", {
              projectId: project.id,
              tab: "schedule",
            }),
          });
        }
      }

    }

    return events.sort((a, b) => a.timestamp - b.timestamp);
  }, [projects, allProjectDetails, tasksQuery.data, filter]);
};
