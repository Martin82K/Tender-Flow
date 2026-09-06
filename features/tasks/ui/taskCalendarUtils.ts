import React from "react";
import { matchesTaskView, type TaskWithSubtasks } from "../model/taskTree";
import type { Task } from "../types";
import { formatDayHint } from "./taskPresentation";

export type TodoCalendarMode = "month" | "week" | "three-day" | "day";

export interface TodoCalendarTask {
  task: Task;
  rootTask: Task;
  isSubtask: boolean;
}

export interface TodoAgendaGroup {
  id: string;
  label: string;
  hint: string;
  tone: "overdue" | "today" | "future";
  items: TodoCalendarTask[];
}

export const TASK_DRAG_DATA_TYPE = "application/x-tender-flow-task-id";

export const flattenCalendarTasks = (tree: TaskWithSubtasks[]): TodoCalendarTask[] =>
  tree.flatMap((item) => {
    const tasks: TodoCalendarTask[] = [];
    if (matchesTaskView(item.task, "calendar")) {
      tasks.push({ task: item.task, rootTask: item.task, isSubtask: false });
    }
    for (const subtask of item.subtasks) {
      if (matchesTaskView(subtask, "calendar")) {
        tasks.push({ task: subtask, rootTask: item.task, isSubtask: true });
      }
    }
    return tasks;
  });

export const startOfLocalDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const startOfLocalWeek = (date: Date): Date => {
  const start = startOfLocalDay(date);
  const day = start.getDay() === 0 ? 7 : start.getDay();
  return addDays(start, 1 - day);
};

export const startOfLocalMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

export const sameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const moveDueAtToLocalDay = (dueAt: string | undefined, targetDay: Date): string | null => {
  const sourceDueAt = dueAt ? new Date(dueAt) : null;
  const nextDueAt = new Date(targetDay);

  if (sourceDueAt && !Number.isNaN(sourceDueAt.getTime())) {
    nextDueAt.setHours(
      sourceDueAt.getHours(),
      sourceDueAt.getMinutes(),
      sourceDueAt.getSeconds(),
      sourceDueAt.getMilliseconds(),
    );
  } else {
    nextDueAt.setHours(17, 0, 0, 0);
  }

  return Number.isNaN(nextDueAt.getTime()) ? null : nextDueAt.toISOString();
};

const getDataTransferTypes = (dataTransfer: DataTransfer): string[] =>
  Array.from(dataTransfer.types ?? []);

export const hasTaskDragPayload = (dataTransfer: DataTransfer): boolean =>
  getDataTransferTypes(dataTransfer).includes(TASK_DRAG_DATA_TYPE);

export const getDraggedTaskIdFromEvent = (
  event: React.DragEvent<HTMLElement>,
  fallbackTaskId: string | null,
): string | null =>
  event.dataTransfer.getData(TASK_DRAG_DATA_TYPE) ||
  event.dataTransfer.getData("text/plain") ||
  fallbackTaskId;

export const compareAgendaItems = (a: TodoCalendarTask, b: TodoCalendarTask): number => {
  const aDue = a.task.dueAt ? new Date(a.task.dueAt).getTime() : Number.POSITIVE_INFINITY;
  const bDue = b.task.dueAt ? new Date(b.task.dueAt).getTime() : Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue - bDue;

  const aPriority = a.task.priority ?? 5;
  const bPriority = b.task.priority ?? 5;
  if (aPriority !== bPriority) return aPriority - bPriority;

  return a.task.createdAt.localeCompare(b.task.createdAt);
};

export const localDateKey = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export const buildUpcomingAgendaGroups = (
  tree: TaskWithSubtasks[],
  now: Date = new Date(),
): TodoAgendaGroup[] => {
  const today = startOfLocalDay(now);
  const tomorrow = addDays(today, 1);
  const grouped = new Map<string, TodoAgendaGroup>();

  const upsertGroup = (due: Date): TodoAgendaGroup => {
    const dayStart = startOfLocalDay(due);
    const overdue = dayStart < today;
    const key = overdue ? "overdue" : localDateKey(dayStart);
    const existing = grouped.get(key);
    if (existing) return existing;

    const group: TodoAgendaGroup = overdue
      ? {
          id: key,
          label: "Zpožděné",
          hint: "Vyžaduje přeplánování",
          tone: "overdue",
          items: [],
        }
      : {
          id: key,
          label: sameLocalDay(dayStart, today)
            ? "Dnes"
            : sameLocalDay(dayStart, tomorrow)
              ? "Zítra"
              : formatDayHint(dayStart),
          hint: dayStart.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" }),
          tone: sameLocalDay(dayStart, today) ? "today" : "future",
          items: [],
        };

    grouped.set(key, group);
    return group;
  };

  for (const item of flattenCalendarTasks(tree)) {
    if (item.task.completed || item.task.archivedAt || !item.task.dueAt) continue;
    const due = new Date(item.task.dueAt);
    if (Number.isNaN(due.getTime())) continue;
    upsertGroup(due).items.push(item);
  }

  const groups = Array.from(grouped.values());
  for (const group of groups) {
    group.items.sort(compareAgendaItems);
  }

  return groups.sort((a, b) => {
    if (a.id === "overdue") return -1;
    if (b.id === "overdue") return 1;
    return a.id.localeCompare(b.id);
  });
};

export const getCalendarDays = (mode: TodoCalendarMode, cursor: Date): Date[] => {
  if (mode === "month") {
    const monthStart = startOfLocalMonth(cursor);
    const gridStart = startOfLocalWeek(monthStart);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }

  const length = mode === "week" ? 7 : mode === "three-day" ? 3 : 1;
  const start = mode === "week" ? startOfLocalWeek(cursor) : startOfLocalDay(cursor);
  return Array.from({ length }, (_, index) => addDays(start, index));
};

export const shiftCalendarCursor = (mode: TodoCalendarMode, cursor: Date, direction: -1 | 1): Date => {
  if (mode === "month") return new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1);
  if (mode === "week") return addDays(cursor, direction * 7);
  if (mode === "three-day") return addDays(cursor, direction * 3);
  return addDays(cursor, direction);
};

export const formatCalendarRange = (mode: TodoCalendarMode, cursor: Date): string => {
  if (mode === "month") {
    return cursor.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });
  }

  const days = getCalendarDays(mode, cursor);
  const first = days[0];
  const last = days[days.length - 1];
  if (sameLocalDay(first, last)) {
    return first.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" });
  }
  return `${first.toLocaleDateString("cs-CZ", { day: "numeric", month: "short" })} - ${last.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
};

export const TODO_PROJECT_COLORS = [
  "#f97316",
  "#f59e0b",
  "#ef4444",
  "#f43f5e",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#64748b",
];

export const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(249, 115, 22, ${alpha})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const getHexLuminance = (hex: string): number => {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return 0.35;

  const channels = [0, 2, 4].map((start) => {
    const value = Number.parseInt(normalized.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

export const getReadableTextColor = (hex: string): string => {
  const luminance = getHexLuminance(hex);
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithDark = (luminance + 0.05) / 0.05;
  return contrastWithDark >= contrastWithWhite ? "#111827" : "#ffffff";
};

export type TodoCalendarTaskStyle = React.CSSProperties & {
  "--todo-project-color": string;
  "--todo-card-background": string;
  "--todo-card-fill": string;
  "--todo-card-text": string;
  "--todo-card-muted": string;
  "--todo-card-chip-background": string;
};

export const getCalendarTaskProjectColor = (
  item: TodoCalendarTask,
  projectColorById: Map<string, string>,
): string | null => {
  const projectId = item.task.todoProjectId ?? item.rootTask.todoProjectId;
  return projectId ? projectColorById.get(projectId) ?? TODO_PROJECT_COLORS[0] : null;
};

export const getCalendarTaskProjectName = (
  item: TodoCalendarTask,
  projectNameById: Map<string, string>,
): string | null => {
  const projectId = item.task.todoProjectId ?? item.rootTask.todoProjectId;
  return projectId ? projectNameById.get(projectId) ?? null : null;
};
