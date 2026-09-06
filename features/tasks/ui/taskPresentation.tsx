import React from "react";
import type { TaskPriority } from "../types";

export const priorityLabel = (priority?: TaskPriority): string => {
  if (!priority) return "Bez priority";
  if (priority === 1) return "P1 urgentní";
  if (priority === 2) return "P2 vysoká";
  if (priority === 3) return "P3 střední";
  return "P4 nízká";
};

export const toDatetimeLocal = (value?: string): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
};

export const datetimeLocalToIso = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const getTaskMutationErrorMessage = (error: unknown): string => {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message)
        : "";

  if (code === "PGRST204" && message.includes("reminder_at")) {
    return "Upozornění vyžaduje databázovou migraci reminder_at. Spusť npx supabase db push a zkus uložení znovu.";
  }

  return message || "Uložení úkolu selhalo.";
};

const isSameLocalDate = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const formatTime = (date: Date): string =>
  date.toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatDayHint = (date: Date): string =>
  date.toLocaleDateString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

export const getLocalDueAt = (dayOffset: number, hour = 17, minute = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return toDatetimeLocal(date.toISOString());
};

export const getReminderBefore = (dueAt: string, minutesBefore: number): string => {
  if (!dueAt) return "";
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "";
  return toDatetimeLocal(new Date(due.getTime() - minutesBefore * 60 * 1000).toISOString());
};

export const formatDue = (value?: string): string => {
  if (!value) return "Bez termínu";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Neplatný termín";

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isSameLocalDate(date, today)) return `Dnes ${formatTime(date)}`;
  if (isSameLocalDate(date, tomorrow)) return `Zítra ${formatTime(date)}`;

  return date.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type MetaBadgeTone =
  | "due-none"
  | "due-invalid"
  | "due-overdue"
  | "due-today"
  | "due-upcoming"
  | "priority-none"
  | "priority-urgent"
  | "priority-high"
  | "priority-medium"
  | "priority-low"
  | "subtasks-none"
  | "subtasks-partial"
  | "subtasks-done"
  | "archive";

const META_BADGE_BASE =
  "tf-task-meta-badge inline-flex min-h-5 items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none";

const META_BADGE_CLASSES: Record<MetaBadgeTone, string> = {
  "due-none": "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
  "due-invalid": "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300",
  "due-overdue": "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300",
  "due-today": "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300",
  "due-upcoming": "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300",
  "priority-none": "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
  "priority-urgent": "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300",
  "priority-high": "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/70 dark:bg-orange-950/30 dark:text-orange-300",
  "priority-medium": "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300",
  "priority-low": "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300",
  "subtasks-none": "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
  "subtasks-partial": "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/70 dark:bg-violet-950/30 dark:text-violet-300",
  "subtasks-done": "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300",
  archive: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
};

export const TASK_MENU_ITEM_BASE =
  "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition";

export const TASK_MENU_ITEM_ACTIVE =
  "border-orange-300 bg-orange-50 text-orange-700 shadow-sm dark:border-orange-900/70 dark:bg-orange-950/30 dark:text-orange-200";

export const TASK_MENU_ITEM_INACTIVE =
  "border-transparent hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-800/70";

export const TASK_MENU_PROJECT_BASE =
  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition";

export const QUICK_ADD_SELECT_CLASS =
  "tf-quick-add-select min-w-0 appearance-none border-0 bg-transparent py-0 pr-5 text-xs font-medium text-slate-700 outline-none ring-0 focus:ring-0 dark:text-slate-200";

export const getDueTone = (value?: string): MetaBadgeTone => {
  if (!value) return "due-none";
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "due-invalid";

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (due.getTime() < now.getTime()) return "due-overdue";
  if (due >= today && due < tomorrow) return "due-today";
  return "due-upcoming";
};

export const getPriorityTone = (priority?: TaskPriority): MetaBadgeTone => {
  if (priority === 1) return "priority-urgent";
  if (priority === 2) return "priority-high";
  if (priority === 3) return "priority-medium";
  if (priority === 4) return "priority-low";
  return "priority-none";
};

export const getSubtaskTone = (done: number, total: number): MetaBadgeTone => {
  if (total === 0) return "subtasks-none";
  if (done === total) return "subtasks-done";
  return "subtasks-partial";
};

interface MetaBadgeProps {
  tone: MetaBadgeTone;
  children: React.ReactNode;
}

export const MetaBadge: React.FC<MetaBadgeProps> = ({ tone, children }) => (
  <span data-tone={tone} className={`${META_BADGE_BASE} ${META_BADGE_CLASSES[tone]}`}>
    {children}
  </span>
);

interface TaskNotePreviewProps {
  note?: string;
  compact?: boolean;
}

export const TaskNotePreview: React.FC<TaskNotePreviewProps> = ({ note, compact = false }) => {
  const value = note?.trim();
  if (!value) return null;

  return (
    <p
      className={`mt-1 whitespace-pre-line text-sm leading-snug text-slate-600 dark:text-slate-300 ${
        compact ? "line-clamp-1" : "line-clamp-2"
      }`}
    >
      {value}
    </p>
  );
};

export const TaskCompletionMark: React.FC<{ completed: boolean }> = ({ completed }) =>
  completed ? <span aria-hidden>✓</span> : null;

export const formatArchivedAt = (value?: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `Archivováno ${date.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
};
