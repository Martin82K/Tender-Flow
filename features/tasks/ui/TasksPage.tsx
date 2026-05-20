import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@shared/ui/Button";
import { ConfirmationModal } from "@shared/ui/ConfirmationModal";
import { Header } from "@shared/ui/Header";
import { Input } from "@shared/ui/Input";
import { HelpButton } from "@features/help";
import { NotificationBell } from "@features/notifications/ui/NotificationBell";
import { useProjectsState } from "@features/projects/model/useProjectsState";
import type { ThemeSkin } from "@/hooks/useTheme";
import {
  buildTaskTree,
  filterTaskTreeByTodoProject,
  findTaskSelection,
  getSubtaskProgress,
  getTodoProjectRootCount,
  matchesTaskView,
  type TaskViewFilter,
  type TaskWithSubtasks,
} from "../model/taskTree";
import {
  useCreateTodoProjectMutation,
  useDeleteTodoProjectMutation,
  useUpdateTodoProjectMutation,
} from "../hooks/useTaskProjectMutations";
import { useTaskProjectsQuery } from "../hooks/useTaskProjectsQuery";
import {
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useToggleTaskMutation,
  useUpdateTaskMutation,
} from "../hooks/useTaskMutations";
import { useTasksQuery } from "../hooks/useTasksQuery";
import { TaskDateTimePicker } from "./TaskDateTimePicker";
import type { Task, TaskCreateInput, TaskPriority, TodoProject } from "../types";

const VIEW_LABELS: Record<TaskViewFilter, { label: string; icon: string; hint: string }> = {
  calendar: { label: "Kalendář", icon: "calendar_month", hint: "Měsíc, týden, 3 dny nebo den" },
  inbox: { label: "Inbox", icon: "inbox", hint: "Rychlý záchyt bez termínu" },
  today: { label: "Dnes", icon: "today", hint: "Co má být hotové dnes" },
  upcoming: { label: "Nadcházející", icon: "event_upcoming", hint: "Plán podle termínu" },
  important: { label: "Důležité", icon: "flag", hint: "Priority P1 a P2" },
  completed: { label: "Hotovo", icon: "task_alt", hint: "Dokončené úkoly" },
  archive: { label: "Archiv", icon: "inventory_2", hint: "Smaže se po 30 dnech" },
};

const VIEW_ORDER: TaskViewFilter[] = ["calendar", "inbox", "today", "upcoming", "important", "completed", "archive"];

const TASKS_DESKTOP_BREAKPOINT = 1024;
const TASKS_DESKTOP_MEDIA_QUERY = `(min-width: ${TASKS_DESKTOP_BREAKPOINT}px)`;

const getIsTasksMobileLayout = (): boolean => {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia === "function") {
    return !window.matchMedia(TASKS_DESKTOP_MEDIA_QUERY).matches;
  }
  return window.innerWidth < TASKS_DESKTOP_BREAKPOINT;
};

const useIsTasksMobileLayout = (): boolean => {
  const [isMobileLayout, setIsMobileLayout] = useState(getIsTasksMobileLayout);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const update = () => setIsMobileLayout(getIsTasksMobileLayout());

    if (typeof window.matchMedia === "function") {
      const mediaQuery = window.matchMedia(TASKS_DESKTOP_MEDIA_QUERY);
      update();
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", update);
        return () => mediaQuery.removeEventListener("change", update);
      }

      mediaQuery.addListener(update);
      return () => mediaQuery.removeListener(update);
    }

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isMobileLayout;
};

type TodoCalendarMode = "month" | "week" | "three-day" | "day";

interface TodoCalendarTask {
  task: Task;
  rootTask: Task;
  isSubtask: boolean;
}

interface TodoAgendaGroup {
  id: string;
  label: string;
  hint: string;
  tone: "overdue" | "today" | "future";
  items: TodoCalendarTask[];
}

const priorityLabel = (priority?: TaskPriority): string => {
  if (!priority) return "Bez priority";
  if (priority === 1) return "P1 urgentní";
  if (priority === 2) return "P2 vysoká";
  if (priority === 3) return "P3 střední";
  return "P4 nízká";
};

const toDatetimeLocal = (value?: string): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
};

const datetimeLocalToIso = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const getTaskMutationErrorMessage = (error: unknown): string => {
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

const formatTime = (date: Date): string =>
  date.toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  });

const formatDayHint = (date: Date): string =>
  date.toLocaleDateString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const getLocalDueAt = (dayOffset: number, hour = 17, minute = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return toDatetimeLocal(date.toISOString());
};

const getReminderBefore = (dueAt: string, minutesBefore: number): string => {
  if (!dueAt) return "";
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "";
  return toDatetimeLocal(new Date(due.getTime() - minutesBefore * 60 * 1000).toISOString());
};

const formatDue = (value?: string): string => {
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

const TASK_MENU_ITEM_BASE =
  "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition";
const TASK_MENU_ITEM_ACTIVE =
  "border-orange-300 bg-orange-50 text-orange-700 shadow-sm dark:border-orange-900/70 dark:bg-orange-950/30 dark:text-orange-200";
const TASK_MENU_ITEM_INACTIVE =
  "border-transparent hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-800/70";

const TASK_MENU_PROJECT_BASE =
  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition";

const QUICK_ADD_SELECT_CLASS =
  "tf-quick-add-select min-w-0 appearance-none border-0 bg-transparent py-0 pr-5 text-xs font-medium text-slate-700 outline-none ring-0 focus:ring-0 dark:text-slate-200";

interface AddSubtaskDialogProps {
  parentTask: Task;
  dialogId: string;
  error: string | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (draft: AddSubtaskDraft) => void;
}

interface AddSubtaskDraft {
  title: string;
  note: string;
  dueAt: string;
  reminderAt: string;
  priority: TaskPriority | "";
  projectId: string;
}

const buildSubtaskCreateInput = (
  parentTask: Task,
  draft: AddSubtaskDraft,
  sortOrder: number,
): TaskCreateInput => {
  const input: TaskCreateInput = {
    title: draft.title.trim(),
    parentTaskId: parentTask.id,
    sortOrder,
  };
  const note = draft.note.trim();
  const dueAt = datetimeLocalToIso(draft.dueAt);
  const reminderAt = datetimeLocalToIso(draft.reminderAt);

  if (note) input.note = note;
  if (dueAt) input.dueAt = dueAt;
  if (reminderAt) input.reminderAt = reminderAt;
  if (draft.priority !== "") input.priority = draft.priority;
  if (parentTask.todoProjectId) input.todoProjectId = parentTask.todoProjectId;
  if (draft.projectId) input.projectId = draft.projectId;

  return input;
};

const AddSubtaskDialog: React.FC<AddSubtaskDialogProps> = ({
  parentTask,
  dialogId,
  error,
  isPending,
  onClose,
  onSubmit,
}) => {
  const { projects } = useProjectsState();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority | "">("");
  const [projectId, setProjectId] = useState(parentTask.projectId ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = `add-subtask-title-${dialogId}`;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const setQuickDue = (dayOffset: number) => {
    setDueAt(getLocalDueAt(dayOffset));
  };

  const setReminderFromDue = (minutesBefore: number) => {
    setReminderAt(getReminderBefore(dueAt, minutesBefore));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      title,
      note,
      dueAt,
      reminderAt,
      priority,
      projectId,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-help-id="task-subtask-create-dialog"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/20 px-4 py-6"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        className="tf-modal-panel relative w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={titleId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Přidat podúkol
            </h3>
            <p className="mt-1 truncate text-xs text-slate-500">
              Pod úkol: {parentTask.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Zavřít přidání podúkolu"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              close
            </span>
          </button>
        </div>

        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Název podúkolu
        </label>
        <input
          ref={inputRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          aria-label="Název podúkolu"
        />
        <label className="mt-3 mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Popis
        </label>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          aria-label="Popis podúkolu"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <TaskDateTimePicker
            label="Datum splnění"
            value={dueAt}
            onChange={setDueAt}
            compact
          />
          <button
            type="button"
            onClick={() => setQuickDue(0)}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Dnes
          </button>
          <button
            type="button"
            onClick={() => setQuickDue(1)}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Zítra
          </button>
          <button
            type="button"
            onClick={() => setQuickDue(7)}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Příští týden
          </button>
          <label className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              flag
            </span>
            <select
              value={priority === "" ? "" : String(priority)}
              onChange={(event) =>
                setPriority(event.target.value === "" ? "" : (Number(event.target.value) as TaskPriority))
              }
              className={QUICK_ADD_SELECT_CLASS}
              aria-label="Priorita podúkolu"
            >
              <option value="">Priorita</option>
              <option value="1">P1 urgentní</option>
              <option value="2">P2 vysoká</option>
              <option value="3">P3 střední</option>
              <option value="4">P4 nízká</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none -ml-5 text-[16px]" aria-hidden>
              arrow_drop_down
            </span>
          </label>
          <TaskDateTimePicker
            label="Upozornění"
            value={reminderAt}
            onChange={setReminderAt}
            compact
          />
          <button
            type="button"
            onClick={() => setReminderFromDue(0)}
            disabled={!dueAt}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Upozornit v termínu
          </button>
          <button
            type="button"
            onClick={() => setReminderFromDue(60)}
            disabled={!dueAt}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            1 h před
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex h-8 min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 sm:max-w-[240px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              apartment
            </span>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className={`${QUICK_ADD_SELECT_CLASS} w-[180px] max-w-full truncate`}
              aria-label="Kontext stavby podúkolu"
            >
              <option value="">Bez stavby</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined pointer-events-none -ml-5 text-[16px]" aria-hidden>
              arrow_drop_down
            </span>
          </label>
        </div>
        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Zrušit
          </Button>
          <Button type="submit" size="sm" disabled={!title.trim()} isLoading={isPending}>
            Přidat podúkol
          </Button>
        </div>
      </form>
    </div>
  );
};

const getDueTone = (value?: string): MetaBadgeTone => {
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

const getPriorityTone = (priority?: TaskPriority): MetaBadgeTone => {
  if (priority === 1) return "priority-urgent";
  if (priority === 2) return "priority-high";
  if (priority === 3) return "priority-medium";
  if (priority === 4) return "priority-low";
  return "priority-none";
};

const getSubtaskTone = (done: number, total: number): MetaBadgeTone => {
  if (total === 0) return "subtasks-none";
  if (done === total) return "subtasks-done";
  return "subtasks-partial";
};

interface MetaBadgeProps {
  tone: MetaBadgeTone;
  children: React.ReactNode;
}

const MetaBadge: React.FC<MetaBadgeProps> = ({ tone, children }) => (
  <span data-tone={tone} className={`${META_BADGE_BASE} ${META_BADGE_CLASSES[tone]}`}>
    {children}
  </span>
);

interface TaskNotePreviewProps {
  note?: string;
  compact?: boolean;
}

const TaskNotePreview: React.FC<TaskNotePreviewProps> = ({ note, compact = false }) => {
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

const TaskCompletionMark: React.FC<{ completed: boolean }> = ({ completed }) =>
  completed ? <span aria-hidden>✓</span> : null;

const formatArchivedAt = (value?: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `Archivováno ${date.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
};

const getViewCount = (tree: TaskWithSubtasks[], view: TaskViewFilter): number =>
  view === "calendar"
    ? flattenCalendarTasks(tree).length
    : view === "upcoming"
      ? buildUpcomingAgendaGroups(tree).reduce((total, group) => total + group.items.length, 0)
    : tree.filter(({ task }) => matchesTaskView(task, view)).length;

const flattenCalendarTasks = (tree: TaskWithSubtasks[]): TodoCalendarTask[] =>
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

const startOfLocalDay = (date: Date): Date => {
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

const startOfLocalMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

const sameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const compareAgendaItems = (a: TodoCalendarTask, b: TodoCalendarTask): number => {
  const aDue = a.task.dueAt ? new Date(a.task.dueAt).getTime() : Number.POSITIVE_INFINITY;
  const bDue = b.task.dueAt ? new Date(b.task.dueAt).getTime() : Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue - bDue;

  const aPriority = a.task.priority ?? 5;
  const bPriority = b.task.priority ?? 5;
  if (aPriority !== bPriority) return aPriority - bPriority;

  return a.task.createdAt.localeCompare(b.task.createdAt);
};

const localDateKey = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export const moveDueAtToLocalDay = (dueAt: string | undefined, targetDay: Date): string | null => {
  if (!dueAt) return null;
  const sourceDue = new Date(dueAt);
  if (Number.isNaN(sourceDue.getTime())) return null;

  return new Date(
    targetDay.getFullYear(),
    targetDay.getMonth(),
    targetDay.getDate(),
    sourceDue.getHours(),
    sourceDue.getMinutes(),
    sourceDue.getSeconds(),
    sourceDue.getMilliseconds(),
  ).toISOString();
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

const getCalendarDays = (mode: TodoCalendarMode, cursor: Date): Date[] => {
  if (mode === "month") {
    const monthStart = startOfLocalMonth(cursor);
    const gridStart = startOfLocalWeek(monthStart);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }

  const length = mode === "week" ? 7 : mode === "three-day" ? 3 : 1;
  const start = mode === "week" ? startOfLocalWeek(cursor) : startOfLocalDay(cursor);
  return Array.from({ length }, (_, index) => addDays(start, index));
};

const shiftCalendarCursor = (mode: TodoCalendarMode, cursor: Date, direction: -1 | 1): Date => {
  if (mode === "month") return new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1);
  if (mode === "week") return addDays(cursor, direction * 7);
  if (mode === "three-day") return addDays(cursor, direction * 3);
  return addDays(cursor, direction);
};

const formatCalendarRange = (mode: TodoCalendarMode, cursor: Date): string => {
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

interface QuickAddProps {
  currentView: TaskViewFilter;
  todoProjectId?: string;
  todoProjects: TodoProject[];
  onExpandedChange?: (expanded: boolean) => void;
}

export const QuickAdd: React.FC<QuickAddProps> = ({
  currentView,
  todoProjectId,
  todoProjects,
  onExpandedChange,
}) => {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority | "">("");
  const [selectedTodoProjectId, setSelectedTodoProjectId] = useState(todoProjectId ?? "");
  const [projectId, setProjectId] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createTask = useCreateTaskMutation();
  const { projects } = useProjectsState();

  useEffect(() => {
    setSelectedTodoProjectId(todoProjectId ?? "");
  }, [todoProjectId]);

  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  const resetForm = () => {
    setTitle("");
    setNote("");
    setDueAt("");
    setReminderAt("");
    setPriority("");
    setSelectedTodoProjectId(todoProjectId ?? "");
    setProjectId("");
    setExpanded(false);
    setError(null);
  };

  const setQuickDue = (dayOffset: number) => {
    setDueAt(getLocalDueAt(dayOffset));
  };

  const setReminderFromDue = (minutesBefore: number) => {
    setReminderAt(getReminderBefore(dueAt, minutesBefore));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = title.trim();
    if (!value || createTask.isPending) return;

    const todayDueAt =
      currentView === "today"
        ? new Date(new Date().setHours(17, 0, 0, 0)).toISOString()
        : undefined;

    try {
      await createTask.mutateAsync({
        title: value,
        note: note.trim() || undefined,
        dueAt: datetimeLocalToIso(dueAt) ?? todayDueAt,
        reminderAt: datetimeLocalToIso(reminderAt) ?? undefined,
        priority: priority === "" ? (currentView === "important" ? 2 : undefined) : priority,
        todoProjectId: selectedTodoProjectId || undefined,
        projectId: projectId || undefined,
      });
      resetForm();
    } catch (err) {
      setError(getTaskMutationErrorMessage(err));
    }
  };

  if (!expanded) {
    return (
      <form
        onSubmit={handleSubmit}
        data-help-id="tasks-quick-add"
        data-state="collapsed"
        className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
      >
        <span className="material-symbols-outlined text-[20px] text-slate-400" aria-hidden>
          add_task
        </span>
        <input
          value={title}
          onFocus={() => setExpanded(true)}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Přidat úkol do osobního TODO..."
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
          aria-label="Nový úkol"
        />
        <Button type="submit" size="sm" disabled={!title.trim()} isLoading={createTask.isPending}>
          Přidat
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-help-id="tasks-quick-add"
      data-state="expanded"
      className="relative z-10 w-full max-w-[920px] rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
    >
      <div className="space-y-2 p-3">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Název úkolu"
          className="w-full bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
          aria-label="Název úkolu"
          autoFocus
        />
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Popis"
          className="w-full resize-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-300"
          aria-label="Popis úkolu"
        />

        <div className="flex flex-wrap items-center gap-2">
          <TaskDateTimePicker
            label="Datum splnění"
            value={dueAt}
            onChange={setDueAt}
            compact
          />
          <button
            type="button"
            onClick={() => setQuickDue(0)}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Dnes
          </button>
          <button
            type="button"
            onClick={() => setQuickDue(1)}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Zítra
          </button>
          <button
            type="button"
            onClick={() => setQuickDue(7)}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Příští týden
          </button>

          <label className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              flag
            </span>
            <select
              value={priority === "" ? "" : String(priority)}
              onChange={(event) =>
                setPriority(event.target.value === "" ? "" : (Number(event.target.value) as TaskPriority))
              }
              className={QUICK_ADD_SELECT_CLASS}
              aria-label="Priorita"
            >
              <option value="">Priorita</option>
              <option value="1">P1 urgentní</option>
              <option value="2">P2 vysoká</option>
              <option value="3">P3 střední</option>
              <option value="4">P4 nízká</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none -ml-5 text-[16px]" aria-hidden>
              arrow_drop_down
            </span>
          </label>

          <TaskDateTimePicker
            label="Upozornění"
            value={reminderAt}
            onChange={setReminderAt}
            compact
          />
          <button
            type="button"
            onClick={() => setReminderFromDue(0)}
            disabled={!dueAt}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Upozornit v termínu
          </button>
          <button
            type="button"
            onClick={() => setReminderFromDue(60)}
            disabled={!dueAt}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            1 h před
          </button>
          <button
            type="button"
            onClick={() => setReminderFromDue(24 * 60)}
            disabled={!dueAt}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Den před
          </button>

          <label className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              tag
            </span>
            <select
              value={selectedTodoProjectId}
              onChange={(event) => setSelectedTodoProjectId(event.target.value)}
              className={`${QUICK_ADD_SELECT_CLASS} max-w-[180px]`}
              aria-label="TODO projekt"
            >
              <option value="">Bez TODO projektu</option>
              {todoProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined pointer-events-none -ml-5 text-[16px]" aria-hidden>
              arrow_drop_down
            </span>
          </label>
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
        <label className="inline-flex h-8 min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 sm:max-w-[240px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <span className="material-symbols-outlined text-[16px]" aria-hidden>
            apartment
          </span>
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className={`${QUICK_ADD_SELECT_CLASS} w-[180px] max-w-full truncate`}
            aria-label="Kontext stavby"
          >
            <option value="">Bez stavby</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined pointer-events-none -ml-5 text-[16px]" aria-hidden>
            arrow_drop_down
          </span>
        </label>

        <Button type="button" variant="secondary" size="sm" onClick={resetForm}>
          Zrušit
        </Button>
        <Button type="submit" size="sm" disabled={!title.trim()} isLoading={createTask.isPending}>
          Přidat úkol
        </Button>
      </div>
    </form>
  );
};

interface TaskListItemProps {
  item: TaskWithSubtasks;
  selected: boolean;
  selectedTaskId: string | null;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onSelect: (taskId: string) => void;
  onDeleted: (task: Task, isSubtask: boolean) => void;
  expanded: boolean;
  onToggleExpanded: (taskId: string) => void;
  onDragStart: (taskId: string, event: React.DragEvent<HTMLElement>) => void;
  onDragOver: (taskId: string, event: React.DragEvent<HTMLElement>) => void;
  onDrop: (taskId: string, event: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

const TaskListItem: React.FC<TaskListItemProps> = ({
  item,
  selected,
  selectedTaskId,
  isDragging = false,
  isDropTarget = false,
  onSelect,
  onDeleted,
  expanded,
  onToggleExpanded,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) => {
  const toggleTask = useToggleTaskMutation();
  const deleteTask = useDeleteTaskMutation();
  const createTask = useCreateTaskMutation();
  const progress = getSubtaskProgress(item.subtasks);
  const archivedLabel = formatArchivedAt(item.task.archivedAt);
  const hasSubtasks = item.subtasks.length > 0;
  const [menuState, setMenuState] = useState<{
    task: Task;
    isSubtask: boolean;
    position: { x: number; y: number };
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ task: Task; isSubtask: boolean } | null>(null);
  const [isSubtaskDialogOpen, setIsSubtaskDialogOpen] = useState(false);
  const [subtaskError, setSubtaskError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuState) return;

    const handlePointer = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuState(null);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuState(null);
    };
    const handleScroll = () => setMenuState(null);

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [menuState]);

  const openContextMenu = (
    event: React.MouseEvent | React.KeyboardEvent,
    task: Task,
    isSubtask: boolean,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const position =
      "clientX" in event
        ? { x: event.clientX, y: event.clientY }
        : {
            x: event.currentTarget.getBoundingClientRect().left + 24,
            y: event.currentTarget.getBoundingClientRect().bottom + 4,
          };

    setMenuState({ task, isSubtask, position });
  };

  const requestDelete = () => {
    if (!menuState) return;
    setDeleteTarget({ task: menuState.task, isSubtask: menuState.isSubtask });
    setMenuState(null);
  };

  const openDetailFromContextMenu = () => {
    if (!menuState) return;
    onSelect(menuState.task.id);
    setMenuState(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteTask.isPending) return;

    await deleteTask.mutateAsync(deleteTarget.task.id);
    onDeleted(deleteTarget.task, deleteTarget.isSubtask);
    setDeleteTarget(null);
  };

  const openSubtaskDialog = (event: React.MouseEvent) => {
    event.stopPropagation();
    setSubtaskError(null);
    setIsSubtaskDialogOpen(true);
  };

  const closeSubtaskDialog = () => {
    if (createTask.isPending) return;
    setIsSubtaskDialogOpen(false);
    setSubtaskError(null);
  };

  const handleCreateSubtask = async (draft: AddSubtaskDraft) => {
    const value = draft.title.trim();
    if (!value || createTask.isPending) return;

    try {
      await createTask.mutateAsync(buildSubtaskCreateInput(item.task, draft, item.subtasks.length));
      if (hasSubtasks && !expanded) {
        onToggleExpanded(item.task.id);
      }
      setIsSubtaskDialogOpen(false);
      setSubtaskError(null);
    } catch (error) {
      setSubtaskError(getTaskMutationErrorMessage(error));
    }
  };

  const menuLeft = menuState
    ? Math.max(8, Math.min(menuState.position.x, (typeof window === "undefined" ? 240 : window.innerWidth) - 188))
    : 0;
  const menuTop = menuState
    ? Math.max(8, Math.min(menuState.position.y, (typeof window === "undefined" ? 240 : window.innerHeight) - 56))
    : 0;

  return (
    <>
      <div
        data-help-id="tasks-list-item"
        data-active={selected ? "true" : "false"}
        data-dragging={isDragging ? "true" : "false"}
        data-drop-target={isDropTarget ? "true" : "false"}
        onDragOver={(event) => onDragOver(item.task.id, event)}
        onDrop={(event) => onDrop(item.task.id, event)}
        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-primary/40 hover:bg-slate-50 data-[active=true]:border-primary data-[active=true]:bg-primary/5 data-[dragging=true]:opacity-55 data-[drop-target=true]:border-primary data-[drop-target=true]:bg-primary/10 data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-primary/25 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:bg-slate-900 dark:data-[active=true]:bg-primary/10"
      >
        <div
          data-help-id="tasks-root-row"
          onContextMenu={(event) => openContextMenu(event, item.task, false)}
          onKeyDown={(event) => {
            if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
              openContextMenu(event, item.task, false);
            }
          }}
          className="flex items-start gap-2.5"
        >
          <button
            type="button"
            draggable
            onDragStart={(event) => onDragStart(item.task.id, event)}
            onDragEnd={onDragEnd}
            className="mt-1 inline-flex size-4 shrink-0 cursor-grab items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label={`Přesunout úkol ${item.task.title}`}
          >
            <span className="material-symbols-outlined text-[12px]" aria-hidden>
              drag_indicator
            </span>
          </button>
          <button
            type="button"
            role="checkbox"
            aria-checked={item.task.completed}
            aria-label={item.task.completed ? "Znovu otevřít úkol" : "Označit úkol jako hotový"}
            onClick={(event) => {
              event.stopPropagation();
              toggleTask.mutate({ id: item.task.id, completed: !item.task.completed });
            }}
            className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[14px] ${
              item.task.completed
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-slate-300 hover:border-emerald-500 dark:border-slate-600"
            }`}
          >
            <TaskCompletionMark completed={item.task.completed} />
          </button>
          <button
            type="button"
            onClick={() => onSelect(item.task.id)}
            className="min-w-0 flex-1 text-left"
          >
            <div className={`text-sm font-semibold ${item.task.completed ? "text-slate-400 line-through" : "text-slate-900 dark:text-slate-100"}`}>
              {item.task.title}
            </div>
            <TaskNotePreview note={item.task.note} />
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <MetaBadge tone={getDueTone(item.task.dueAt)}>{formatDue(item.task.dueAt)}</MetaBadge>
              {item.task.reminderAt && (
                <MetaBadge tone={getDueTone(item.task.reminderAt)}>
                  Upozornění {formatDue(item.task.reminderAt)}
                </MetaBadge>
              )}
              <MetaBadge tone={getPriorityTone(item.task.priority)}>
                {priorityLabel(item.task.priority)}
              </MetaBadge>
              {archivedLabel && <MetaBadge tone="archive">{archivedLabel}</MetaBadge>}
              {progress.total > 0 && (
                <MetaBadge tone={getSubtaskTone(progress.done, progress.total)}>
                  Podúkoly {progress.done}/{progress.total}
                </MetaBadge>
              )}
            </div>
          </button>
          {hasSubtasks ? (
            <div
              data-help-id="tasks-list-item-actions"
              className="mt-7 flex shrink-0 items-center gap-2.5"
            >
              <button
                type="button"
                onClick={openSubtaskDialog}
                className="inline-flex size-5 items-center justify-center rounded text-slate-500 transition hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/15"
                aria-label={`Přidat podúkol k úkolu ${item.task.title}`}
              >
                <span className="material-symbols-outlined text-[13px]" aria-hidden>
                  add_task
                </span>
              </button>
              <button
                type="button"
                onClick={() => onToggleExpanded(item.task.id)}
                className="inline-flex size-5 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-expanded={expanded}
                aria-label={expanded ? "Sbalit podúkoly" : "Rozbalit podúkoly"}
              >
                <span className={`material-symbols-outlined text-[14px] transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden>
                  expand_more
                </span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openSubtaskDialog}
              className="mt-7 inline-flex size-5 shrink-0 items-center justify-center rounded text-slate-500 transition hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/15"
              aria-label={`Přidat podúkol k úkolu ${item.task.title}`}
            >
              <span className="material-symbols-outlined text-[13px]" aria-hidden>
                add_task
              </span>
            </button>
          )}
        </div>
        {hasSubtasks && expanded && (
          <div className="mt-3 ml-7 space-y-1.5 border-l border-slate-200 pl-3 dark:border-slate-800">
            {item.subtasks.map((subtask) => (
              <div
                key={subtask.id}
                data-active={selectedTaskId === subtask.id ? "true" : "false"}
                onDoubleClick={() => onSelect(subtask.id)}
                onContextMenu={(event) => openContextMenu(event, subtask, true)}
                onKeyDown={(event) => {
                  if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                    openContextMenu(event, subtask, true);
                  }
                }}
                className="group flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 text-sm dark:border-slate-800 dark:bg-slate-950/40"
                data-help-id="tasks-subtask-row"
              >
                <button
                  type="button"
                  onClick={() => toggleTask.mutate({ id: subtask.id, completed: !subtask.completed })}
                  className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[13px] ${
                    subtask.completed
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300 hover:border-emerald-500 dark:border-slate-600"
                  }`}
                  aria-label={subtask.completed ? "Znovu otevřít podúkol" : "Označit podúkol jako hotový"}
                >
                  <TaskCompletionMark completed={subtask.completed} />
                </button>
                <button
                  type="button"
                  onClick={() => onSelect(subtask.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span
                    className={`block truncate text-sm ${
                      subtask.completed
                        ? "text-slate-400 line-through"
                        : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {subtask.title}
                  </span>
                  <TaskNotePreview note={subtask.note} compact />
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <MetaBadge tone={getDueTone(subtask.dueAt)}>{formatDue(subtask.dueAt)}</MetaBadge>
                    {subtask.reminderAt && (
                      <MetaBadge tone={getDueTone(subtask.reminderAt)}>
                        Upozornění {formatDue(subtask.reminderAt)}
                      </MetaBadge>
                    )}
                    <MetaBadge tone={getPriorityTone(subtask.priority)}>
                      {priorityLabel(subtask.priority)}
                    </MetaBadge>
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {menuState && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={menuState.isSubtask ? "Akce podúkolu" : "Akce úkolu"}
          data-help-id="task-context-menu"
          className="fixed z-[80] w-[180px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
          style={{ left: menuLeft, top: menuTop }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={openDetailFromContextMenu}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              edit_note
            </span>
            {menuState.isSubtask ? "Otevřít detail podúkolu" : "Otevřít detail úkolu"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={requestDelete}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            disabled={deleteTask.isPending}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              delete
            </span>
            {menuState.isSubtask ? "Smazat podúkol" : "Smazat úkol"}
          </button>
        </div>
      )}

      {isSubtaskDialogOpen && (
        <AddSubtaskDialog
          parentTask={item.task}
          dialogId={`list-${item.task.id}`}
          error={subtaskError}
          isPending={createTask.isPending}
          onClose={closeSubtaskDialog}
          onSubmit={handleCreateSubtask}
        />
      )}

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title={deleteTarget?.isSubtask ? "Smazat podúkol?" : "Smazat úkol?"}
        message={
          deleteTarget?.isSubtask
            ? `Podúkol "${deleteTarget.task.title}" bude trvale odstraněn.`
            : `Úkol "${deleteTarget?.task.title ?? ""}" bude trvale odstraněn včetně podúkolů.`
        }
        confirmLabel={deleteTarget?.isSubtask ? "Smazat podúkol" : "Smazat úkol"}
        cancelLabel="Zrušit"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />
    </>
  );
};

interface TodoCalendarViewProps {
  tree: TaskWithSubtasks[];
  todoProjects: TodoProject[];
  selectedTaskId: string | null;
  draggedTaskId: string | null;
  dropTargetDayKey: string | null;
  mode: TodoCalendarMode;
  cursorDate: Date;
  onModeChange: (mode: TodoCalendarMode) => void;
  onCursorChange: (date: Date) => void;
  onSelectTask: (taskId: string) => void;
  onTaskDragStart: (taskId: string, event: React.DragEvent<HTMLElement>) => void;
  onDayDragOver: (day: Date, event: React.DragEvent<HTMLElement>) => void;
  onDayDrop: (day: Date, event: React.DragEvent<HTMLElement>) => void;
  onTaskDragEnd: () => void;
}

const CALENDAR_MODE_LABELS: Record<TodoCalendarMode, string> = {
  month: "Měsíc",
  week: "Týden",
  "three-day": "3 dny",
  day: "Den",
};

const TODO_PROJECT_COLORS = [
  "#f97316",
  "#ef4444",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

const hexToRgba = (hex: string, alpha: number): string => {
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

const getReadableTextColor = (hex: string): string => {
  const luminance = getHexLuminance(hex);
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithDark = (luminance + 0.05) / 0.05;
  return contrastWithDark >= contrastWithWhite ? "#111827" : "#ffffff";
};

type TodoCalendarTaskStyle = React.CSSProperties & {
  "--todo-project-color": string;
  "--todo-card-background": string;
  "--todo-card-fill": string;
  "--todo-card-text": string;
  "--todo-card-muted": string;
  "--todo-card-chip-background": string;
};

const getCalendarTaskProjectColor = (
  item: TodoCalendarTask,
  projectColorById: Map<string, string>,
): string | null => {
  const projectId = item.task.todoProjectId ?? item.rootTask.todoProjectId;
  return projectId ? projectColorById.get(projectId) ?? TODO_PROJECT_COLORS[0] : null;
};

const getCalendarTaskProjectName = (
  item: TodoCalendarTask,
  projectNameById: Map<string, string>,
): string | null => {
  const projectId = item.task.todoProjectId ?? item.rootTask.todoProjectId;
  return projectId ? projectNameById.get(projectId) ?? null : null;
};

const TodoCalendarView: React.FC<TodoCalendarViewProps> = ({
  tree,
  todoProjects,
  selectedTaskId,
  draggedTaskId,
  dropTargetDayKey,
  mode,
  cursorDate,
  onModeChange,
  onCursorChange,
  onSelectTask,
  onTaskDragStart,
  onDayDragOver,
  onDayDrop,
  onTaskDragEnd,
}) => {
  const today = startOfLocalDay(new Date());
  const days = getCalendarDays(mode, cursorDate);
  const calendarTasks = flattenCalendarTasks(tree);
  const projectColorById = useMemo(
    () => new Map(todoProjects.map((project) => [project.id, project.color ?? TODO_PROJECT_COLORS[0]])),
    [todoProjects],
  );
  const projectNameById = useMemo(
    () => new Map(todoProjects.map((project) => [project.id, project.name])),
    [todoProjects],
  );
  const tasksByDay = useMemo(() => {
    const grouped = new Map<string, TodoCalendarTask[]>();
    for (const item of calendarTasks) {
      if (!item.task.dueAt) continue;
      const due = new Date(item.task.dueAt);
      if (Number.isNaN(due.getTime())) continue;
      const key = localDateKey(due);
      const group = grouped.get(key) ?? [];
      group.push(item);
      grouped.set(key, group);
    }

    for (const group of grouped.values()) {
      group.sort(compareAgendaItems);
    }
    return grouped;
  }, [calendarTasks]);
  const monthCursor = startOfLocalMonth(cursorDate);
  const compact = mode === "month";

  return (
    <div
      data-help-id="tasks-calendar"
      className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {formatCalendarRange(mode, cursorDate)}
          </h3>
          <p className="text-xs text-slate-500">Úkoly s termínem splnění</p>
        </div>
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900">
          {(Object.keys(CALENDAR_MODE_LABELS) as TodoCalendarMode[]).map((item) => (
            <button
              key={item}
              type="button"
              data-active={mode === item ? "true" : "false"}
              onClick={() => onModeChange(item)}
              className="h-7 rounded-md px-2 text-xs font-semibold text-slate-500 transition hover:text-slate-900 data-[active=true]:bg-white data-[active=true]:text-primary data-[active=true]:shadow-sm dark:hover:text-slate-100 dark:data-[active=true]:bg-slate-800"
            >
              {CALENDAR_MODE_LABELS[item]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onCursorChange(shiftCalendarCursor(mode, cursorDate, -1))}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Předchozí období"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              chevron_left
            </span>
          </button>
          <button
            type="button"
            onClick={() => onCursorChange(new Date())}
            className="h-8 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Dnes
          </button>
          <button
            type="button"
            onClick={() => onCursorChange(shiftCalendarCursor(mode, cursorDate, 1))}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Další období"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              chevron_right
            </span>
          </button>
        </div>
      </div>

      <div
        className={`grid min-h-[480px] ${compact ? "grid-cols-7" : ""}`}
        style={compact ? undefined : { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {days.map((day) => {
          const key = localDateKey(day);
          const tasks = tasksByDay.get(key) ?? [];
          const outsideMonth = compact && day.getMonth() !== monthCursor.getMonth();
          const isToday = sameLocalDay(day, today);
          return (
            <div
              key={key}
              data-help-id="todo-calendar-day"
              data-date={key}
              data-drop-target={dropTargetDayKey === key ? "true" : "false"}
              onDragOver={(event) => onDayDragOver(day, event)}
              onDrop={(event) => onDayDrop(day, event)}
              className={`min-h-[118px] border-r border-b border-slate-200 p-2 transition last:border-r-0 data-[drop-target=true]:bg-primary/10 data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-inset data-[drop-target=true]:ring-primary/30 dark:border-slate-800 ${
                outsideMonth ? "bg-slate-50/70 text-slate-400 dark:bg-slate-950/30" : ""
              } ${isToday ? "bg-primary/5" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase text-slate-500">
                    {day.toLocaleDateString("cs-CZ", { weekday: "short" })}
                  </div>
                  <div className={`text-sm font-bold ${isToday ? "text-primary" : "text-slate-900 dark:text-slate-100"}`}>
                    {day.toLocaleDateString("cs-CZ", { day: "numeric", month: compact ? undefined : "short" })}
                  </div>
                </div>
                {tasks.length > 0 && <MetaBadge tone="subtasks-partial">{tasks.length}</MetaBadge>}
              </div>

              <div className="space-y-1.5">
                {tasks.map(({ task, rootTask, isSubtask }) => {
                  const assignedProjectColor = getCalendarTaskProjectColor(
                    { task, rootTask, isSubtask },
                    projectColorById,
                  );
                  const projectColor = assignedProjectColor ?? "var(--tf-skin-line-2)";
                  const projectName = getCalendarTaskProjectName({ task, rootTask, isSubtask }, projectNameById);
                  const textColor = assignedProjectColor ? getReadableTextColor(assignedProjectColor) : "var(--tf-skin-text)";
                  const mutedTextColor = assignedProjectColor
                    ? hexToRgba(textColor === "#ffffff" ? "#ffffff" : "#111827", 0.76)
                    : "var(--tf-skin-muted)";
                  const cardBackground = assignedProjectColor
                    ? assignedProjectColor
                    : "color-mix(in srgb, var(--tf-skin-surface-muted) 84%, transparent)";
                  const cardFill = assignedProjectColor
                    ? `color-mix(in srgb, ${assignedProjectColor} 72%, var(--tf-skin-surface) 28%)`
                    : cardBackground;
                  const chipBackground = assignedProjectColor
                    ? hexToRgba(textColor === "#ffffff" ? "#ffffff" : "#111827", 0.14)
                    : "color-mix(in srgb, var(--tf-skin-surface) 74%, transparent)";
                  const cardShadow =
                    selectedTaskId === task.id
                      ? assignedProjectColor
                        ? `0 0 0 1px ${assignedProjectColor}, 0 8px 18px ${hexToRgba(assignedProjectColor, 0.22)}`
                        : "0 0 0 1px var(--tf-skin-line-2)"
                      : undefined;
                  const cardStyle: TodoCalendarTaskStyle = {
                    "--todo-project-color": projectColor,
                    "--todo-card-background": cardBackground,
                    "--todo-card-fill": cardFill,
                    "--todo-card-text": textColor,
                    "--todo-card-muted": mutedTextColor,
                    "--todo-card-chip-background": chipBackground,
                    borderColor: projectColor,
                    backgroundColor: cardBackground,
                    backgroundImage: "none",
                    boxShadow: cardShadow,
                    color: textColor,
                  };
                  const note = task.note?.trim();

                  return (
                    <div
                      key={task.id}
                      role="button"
                      tabIndex={0}
                      draggable
                      data-active={selectedTaskId === task.id ? "true" : "false"}
                      data-dragging={draggedTaskId === task.id ? "true" : "false"}
                      data-has-project={assignedProjectColor ? "true" : "false"}
                      data-help-id="todo-calendar-task"
                      aria-label={`Přesunout nebo otevřít úkol ${task.title}`}
                      onClick={() => onSelectTask(task.id)}
                      onDragStart={(event) => onTaskDragStart(task.id, event)}
                      onDragEnd={onTaskDragEnd}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectTask(task.id);
                        }
                      }}
                      className="relative w-full cursor-grab overflow-hidden rounded-lg border px-2 py-1.5 text-left text-xs shadow-sm outline-none transition hover:-translate-y-px focus:ring-2 focus:ring-offset-1 active:cursor-grabbing data-[active=true]:shadow-md data-[dragging=true]:opacity-55"
                      style={cardStyle}
                    >
                      <span className="block min-w-0" data-help-id="todo-calendar-task-heading">
                        {projectName && (
                          <span
                            data-help-id="todo-calendar-task-chip"
                            className="mb-1 inline-flex max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-bold"
                            style={{
                              backgroundColor: "var(--todo-card-chip-background)",
                              color: "var(--todo-card-text)",
                            }}
                          >
                            # {projectName}
                          </span>
                        )}
                        <span
                          data-help-id="todo-calendar-task-title"
                          className="block min-w-0 whitespace-normal break-words font-semibold leading-snug"
                        >
                          {isSubtask ? `↳ ${task.title}` : task.title}
                        </span>
                      </span>
                      {note && (
                        <span
                          data-help-id="todo-calendar-task-muted"
                          className={`${compact ? "hidden xl:block" : "block"} mt-1 text-[11px] leading-snug`}
                          style={{
                            display: compact ? undefined : "-webkit-box",
                            WebkitLineClamp: compact ? undefined : 2,
                            WebkitBoxOrient: compact ? undefined : "vertical",
                            overflow: "hidden",
                            color: mutedTextColor,
                          }}
                        >
                          {note}
                        </span>
                      )}
                      <span className="mt-0.5 flex flex-wrap items-center gap-1">
                        <span data-help-id="todo-calendar-task-muted" className="text-[11px]" style={{ color: mutedTextColor }}>
                          {formatTime(new Date(task.dueAt ?? ""))}
                        </span>
                        {isSubtask && (
                          <span
                            data-help-id="todo-calendar-task-muted"
                            className="truncate text-[11px]"
                            style={{ color: mutedTextColor }}
                          >
                            {rootTask.title}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface TodoAgendaViewProps {
  tree: TaskWithSubtasks[];
  todoProjects: TodoProject[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}

const TODO_AGENDA_TONE_CLASSES: Record<TodoAgendaGroup["tone"], string> = {
  overdue: "border-red-200 bg-red-50/70 text-red-700 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-300",
  today: "border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-300",
  future: "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200",
};

const TodoAgendaView: React.FC<TodoAgendaViewProps> = ({
  tree,
  todoProjects,
  selectedTaskId,
  onSelectTask,
}) => {
  const toggleTask = useToggleTaskMutation();
  const groups = useMemo(() => buildUpcomingAgendaGroups(tree), [tree]);
  const projectNameById = useMemo(
    () => new Map(todoProjects.map((project) => [project.id, project.name])),
    [todoProjects],
  );

  if (groups.length === 0) {
    return (
      <div
        data-help-id="tasks-upcoming-agenda"
        className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
      >
        Žádné naplánované úkoly.
      </div>
    );
  }

  return (
    <div
      data-help-id="tasks-upcoming-agenda"
      className="max-h-full space-y-3 overflow-y-auto pr-1"
    >
      {groups.map((group) => (
        <section
          key={group.id}
          aria-label={group.label}
          data-help-id="todo-agenda-group"
          className={`rounded-xl border p-3 shadow-sm ${TODO_AGENDA_TONE_CLASSES[group.tone]}`}
        >
          <div className="mb-2 flex items-center justify-between gap-3 border-b border-current/10 pb-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{group.label}</h3>
              <p className="text-xs opacity-75">{group.hint}</p>
            </div>
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-current/10 text-xs font-bold">
              {group.items.length}
            </span>
          </div>

          <div className="space-y-1.5">
            {group.items.map(({ task, rootTask, isSubtask }) => {
              const projectId = task.todoProjectId ?? rootTask.todoProjectId;
              const projectName = projectId ? projectNameById.get(projectId) : undefined;
              const due = task.dueAt ? new Date(task.dueAt) : null;
              const dueTime = due && !Number.isNaN(due.getTime()) ? formatTime(due) : "Bez času";

              return (
                <div
                  key={task.id}
                  data-active={selectedTaskId === task.id ? "true" : "false"}
                  data-help-id="todo-agenda-row"
                  className="group flex min-w-0 items-start gap-3 rounded-lg border border-slate-200/80 bg-white/85 px-3 py-2 text-slate-900 shadow-sm transition hover:border-primary/40 hover:bg-white data-[active=true]:border-primary data-[active=true]:ring-1 data-[active=true]:ring-primary/25 dark:border-slate-800 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:bg-slate-900"
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={task.completed}
                    aria-label={task.completed ? "Znovu otevřít úkol" : "Označit úkol jako hotový"}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleTask.mutate({ id: task.id, completed: !task.completed });
                    }}
                    className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[14px] ${
                      task.completed
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 bg-white hover:border-emerald-500 dark:border-slate-600 dark:bg-slate-950"
                    }`}
                  >
                    <TaskCompletionMark completed={task.completed} />
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectTask(task.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {isSubtask ? task.title : task.title}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {dueTime}
                      </span>
                    </span>
                    {isSubtask && (
                      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                        Pod úkolem: {rootTask.title}
                      </span>
                    )}
                    <TaskNotePreview note={task.note} compact />
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <MetaBadge tone={getPriorityTone(task.priority)}>
                        {priorityLabel(task.priority)}
                      </MetaBadge>
                      {projectName && <MetaBadge tone="subtasks-partial"># {projectName}</MetaBadge>}
                      {task.reminderAt && (
                        <MetaBadge tone={getDueTone(task.reminderAt)}>
                          Upozornění {formatDue(task.reminderAt)}
                        </MetaBadge>
                      )}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

interface TodoProjectSectionProps {
  projects: TodoProject[];
  selectedTodoProjectId: string | null;
  taskTree: TaskWithSubtasks[];
  onSelectProject: (projectId: string) => void;
  onProjectDeleted: (projectId: string) => void;
}

export const TodoProjectSection: React.FC<TodoProjectSectionProps> = ({
  projects,
  selectedTodoProjectId,
  taskTree,
  onSelectProject,
  onProjectDeleted,
}) => {
  const createProject = useCreateTodoProjectMutation();
  const updateProject = useUpdateTodoProjectMutation();
  const deleteProject = useDeleteTodoProjectMutation();
  const [name, setName] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TodoProject | null>(null);
  const [menuState, setMenuState] = useState<{
    project: TodoProject;
    position: { x: number; y: number };
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuState) return;

    const handlePointer = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuState(null);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuState(null);
    };
    const handleScroll = () => setMenuState(null);

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [menuState]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = name.trim();
    if (!value || createProject.isPending) return;

    await createProject.mutateAsync({
      name: value,
      sortOrder: projects.length,
    });
    setName("");
  };

  const openContextMenu = (
    event: React.MouseEvent | React.KeyboardEvent,
    project: TodoProject,
  ) => {
    event.preventDefault();
    const position =
      "clientX" in event
        ? { x: event.clientX, y: event.clientY }
        : {
            x: event.currentTarget.getBoundingClientRect().left + 24,
            y: event.currentTarget.getBoundingClientRect().bottom + 4,
          };

    setMenuState({ project, position });
  };

  const startEditingProject = (project: TodoProject) => {
    setEditingProjectId(project.id);
    setEditingName(project.name);
    setEditingColor(project.color ?? null);
    setMenuState(null);
  };

  const handleChangeProjectColor = async (project: TodoProject, color: string | null) => {
    const nextColor = color ?? null;
    if ((project.color ?? null) === nextColor || updateProject.isPending) {
      setMenuState(null);
      return;
    }

    await updateProject.mutateAsync({
      id: project.id,
      input: { color: nextColor },
    });
    setMenuState(null);
  };

  const cancelEditingProject = () => {
    setEditingProjectId(null);
    setEditingName("");
    setEditingColor(null);
  };

  const handleRenameProject = async (event: React.FormEvent, project: TodoProject) => {
    event.preventDefault();
    const value = editingName.trim();
    const colorChanged = (editingColor ?? null) !== (project.color ?? null);
    const nameChanged = value !== project.name;
    if (!value || (!nameChanged && !colorChanged) || updateProject.isPending) {
      cancelEditingProject();
      return;
    }

    await updateProject.mutateAsync({
      id: project.id,
      input: {
        ...(nameChanged ? { name: value } : {}),
        ...(colorChanged ? { color: editingColor } : {}),
      },
    });
    cancelEditingProject();
  };

  const handleConfirmDeleteProject = async () => {
    if (!deleteTarget || deleteProject.isPending) return;

    const projectId = deleteTarget.id;
    await deleteProject.mutateAsync(projectId);
    onProjectDeleted(projectId);
    if (editingProjectId === projectId) {
      cancelEditingProject();
    }
    setDeleteTarget(null);
  };

  const menuLeft = menuState
    ? Math.max(8, Math.min(menuState.position.x, (typeof window === "undefined" ? 240 : window.innerWidth) - 220))
    : 0;
  const menuTop = menuState
    ? Math.max(8, Math.min(menuState.position.y, (typeof window === "undefined" ? 240 : window.innerHeight) - 208))
    : 0;

  return (
    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between gap-2 px-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Moje projekty
        </h3>
      </div>

      <div className="space-y-1">
        {projects.map((project) => {
          const active = selectedTodoProjectId === project.id;
          const editing = editingProjectId === project.id;

          if (editing) {
            return (
              <form
                key={project.id}
                onSubmit={(event) => handleRenameProject(event, project)}
                className="space-y-2 rounded-lg border border-primary/40 bg-slate-50 px-2 py-1.5 shadow-sm dark:bg-slate-900"
              >
                <div className="flex items-center gap-1">
                  <span
                    className="text-base font-black"
                    style={{ color: editingColor ?? "var(--color-primary, #f97316)" }}
                    aria-hidden
                  >
                    #
                  </span>
                  <input
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEditingProject();
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none dark:text-slate-100"
                    aria-label="Název TODO projektu"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="inline-flex size-7 items-center justify-center rounded-md text-primary transition hover:bg-primary/10 disabled:opacity-40"
                    disabled={!editingName.trim() || updateProject.isPending}
                    aria-label="Uložit TODO projekt"
                  >
                    <span className="material-symbols-outlined text-[17px]" aria-hidden>
                      check
                    </span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200 dark:hover:bg-slate-800"
                    onClick={cancelEditingProject}
                    aria-label="Zrušit editaci TODO projektu"
                  >
                    <span className="material-symbols-outlined text-[17px]" aria-hidden>
                      close
                    </span>
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pl-4" aria-label="Barva TODO projektu">
                  <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Barva
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingColor(null)}
                    aria-pressed={editingColor === null}
                    data-active={editingColor === null ? "true" : "false"}
                    className="inline-flex size-6 items-center justify-center rounded-md border border-slate-300 text-[11px] font-bold text-slate-500 transition data-[active=true]:ring-2 data-[active=true]:ring-primary dark:border-slate-600"
                    aria-label="Výchozí barva"
                  >
                    ×
                  </button>
                  {TODO_PROJECT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditingColor(color)}
                      aria-pressed={editingColor === color}
                      data-active={editingColor === color ? "true" : "false"}
                      className="inline-flex size-6 items-center justify-center rounded-md border border-slate-300 transition data-[active=true]:ring-2 data-[active=true]:ring-primary dark:border-slate-600"
                      aria-label={`Barva ${color}`}
                    >
                      <span
                        className="block size-3.5 rounded-full shadow-sm"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
              </form>
            );
          }

          return (
            <button
              key={project.id}
              type="button"
              data-active={active ? "true" : "false"}
              data-help-id="todo-project-item"
              aria-current={active ? "page" : undefined}
              onClick={() => onSelectProject(project.id)}
              onContextMenu={(event) => openContextMenu(event, project)}
              onKeyDown={(event) => {
                if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                  openContextMenu(event, project);
                }
              }}
              className={`${TASK_MENU_PROJECT_BASE} ${
                active
                  ? "border-orange-300 bg-orange-50 text-orange-700 shadow-sm dark:border-orange-900/70 dark:bg-orange-950/30 dark:text-orange-200"
                  : "border-transparent hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-800/70"
              }`}
              title="Pravým tlačítkem otevřete akce projektu"
            >
              <span
                className={`text-primary ${active ? "font-black" : ""}`}
                style={project.color ? { color: project.color } : undefined}
                aria-hidden
              >
                #
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
              <span className="text-xs text-slate-500">{getTodoProjectRootCount(taskTree, project.id)}</span>
            </button>
          );
        })}
      </div>

      {menuState && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Akce TODO projektu"
          data-help-id="todo-project-context-menu"
          className="fixed z-[80] w-[212px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
          style={{ left: menuLeft, top: menuTop }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => startEditingProject(menuState.project)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              edit
            </span>
            Upravit projekt
          </button>
          <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-700">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                palette
              </span>
              Změnit barvu
            </div>
            <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Změnit barvu TODO projektu">
              <button
                type="button"
                onClick={() => void handleChangeProjectColor(menuState.project, null)}
                aria-pressed={!menuState.project.color}
                data-active={!menuState.project.color ? "true" : "false"}
                className="inline-flex size-7 items-center justify-center rounded-md border border-slate-300 text-[12px] font-bold text-slate-500 transition hover:bg-slate-50 data-[active=true]:ring-2 data-[active=true]:ring-primary dark:border-slate-600 dark:hover:bg-slate-800"
                aria-label="Výchozí barva projektu"
                disabled={updateProject.isPending}
              >
                ×
              </button>
              {TODO_PROJECT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => void handleChangeProjectColor(menuState.project, color)}
                  aria-pressed={menuState.project.color === color}
                  data-active={menuState.project.color === color ? "true" : "false"}
                  className="inline-flex size-7 items-center justify-center rounded-md border border-slate-300 transition hover:bg-slate-50 data-[active=true]:ring-2 data-[active=true]:ring-primary dark:border-slate-600 dark:hover:bg-slate-800"
                  aria-label={`Změnit barvu projektu na ${color}`}
                  disabled={updateProject.isPending}
                >
                  <span
                    className="block size-4 rounded-full shadow-sm"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setDeleteTarget(menuState.project);
              setMenuState(null);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              delete
            </span>
            Smazat projekt
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2 px-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nový projekt..."
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          aria-label="Nový TODO projekt"
        />
        <Button type="submit" size="sm" variant="outline" disabled={!name.trim()} isLoading={createProject.isPending}>
          Přidat
        </Button>
      </form>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title="Smazat TODO projekt?"
        message={
          deleteTarget
            ? `Projekt "${deleteTarget.name}" bude smazán. Úkoly zůstanou zachované a přesunou se do "Bez TODO projektu".`
            : ""
        }
        confirmLabel="Smazat projekt"
        cancelLabel="Zrušit"
        onConfirm={handleConfirmDeleteProject}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  );
};

interface TaskDetailProps {
  item?: TaskWithSubtasks;
  selectedTask?: Task;
  todoProjects: TodoProject[];
  isSubtask?: boolean;
  isComposerActive?: boolean;
  isMobileSheet?: boolean;
  onSelectTask: (taskId: string) => void;
  onDeleted: () => void;
  onCloseDetail?: () => void;
}

const TaskDetail: React.FC<TaskDetailProps> = ({
  item,
  selectedTask,
  todoProjects,
  isSubtask = false,
  isComposerActive = false,
  isMobileSheet = false,
  onSelectTask,
  onDeleted,
  onCloseDetail,
}) => {
  const { projects } = useProjectsState();
  const updateTask = useUpdateTaskMutation();
  const deleteTask = useDeleteTaskMutation();
  const toggleTask = useToggleTaskMutation();
  const createTask = useCreateTaskMutation();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority | "">("");
  const [todoProjectId, setTodoProjectId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [subtaskError, setSubtaskError] = useState<string | null>(null);
  const [renamingSubtask, setRenamingSubtask] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ task: Task; isSubtask: boolean } | null>(null);
  const [isSubtaskDialogOpen, setIsSubtaskDialogOpen] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasUnsavedChanges = Boolean(
    selectedTask &&
      (
        title !== selectedTask.title ||
        note !== (selectedTask.note ?? "") ||
        dueAt !== toDatetimeLocal(selectedTask.dueAt) ||
        reminderAt !== toDatetimeLocal(selectedTask.reminderAt) ||
        priority !== (selectedTask.priority ?? "") ||
        todoProjectId !== (selectedTask.todoProjectId ?? "") ||
        projectId !== (selectedTask.projectId ?? "")
      ),
  );

  useEffect(() => {
    setError(null);
    if (!item || !selectedTask) {
      setTitle("");
      setNote("");
      setDueAt("");
      setReminderAt("");
      setPriority("");
      setTodoProjectId("");
      setProjectId("");
      setSubtaskError(null);
      setRenamingSubtask({});
      setIsSubtaskDialogOpen(false);
      return;
    }

    setTitle(selectedTask.title);
    setNote(selectedTask.note ?? "");
    setDueAt(toDatetimeLocal(selectedTask.dueAt));
    setReminderAt(toDatetimeLocal(selectedTask.reminderAt));
    setPriority(selectedTask.priority ?? "");
    setTodoProjectId(selectedTask.todoProjectId ?? "");
    setProjectId(selectedTask.projectId ?? "");
    setSubtaskError(null);
    setRenamingSubtask(Object.fromEntries(item.subtasks.map((task) => [task.id, task.title])));
    setIsSubtaskDialogOpen(false);
    setIsCloseConfirmOpen(false);
  }, [item, selectedTask]);

  useEffect(() => {
    if (!onCloseDetail || !selectedTask) return undefined;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || deleteTarget || isCloseConfirmOpen) return;
      event.preventDefault();
      if (hasUnsavedChanges) {
        setIsCloseConfirmOpen(true);
        return;
      }
      onCloseDetail();
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [deleteTarget, hasUnsavedChanges, isCloseConfirmOpen, onCloseDetail, selectedTask]);

  if (!item || !selectedTask) {
    if (isMobileSheet) {
      return null;
    }

    if (isComposerActive) {
      return (
        <aside
          className="hidden min-h-[420px] rounded-xl border border-transparent bg-transparent lg:block"
          aria-hidden
        />
      );
    }

    return (
      <aside
        data-help-id="tasks-detail"
        className="min-h-0 overflow-hidden rounded-xl border border-orange-200/70 bg-white/85 p-3 shadow-sm max-lg:hidden dark:border-orange-900/40 dark:bg-slate-900/70"
      >
        <div className="flex h-full min-h-[420px] flex-col">
          <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Detail úkolu
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Personal scope · props do Command Center
            </div>
          </div>

          <div
            data-help-id="tasks-detail-empty"
            className="flex flex-1 items-center justify-center px-4 py-10 text-center"
          >
            <div className="max-w-[260px]">
              <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-primary dark:border-orange-900/60 dark:bg-orange-950/30">
                <span className="material-symbols-outlined text-[24px]" aria-hidden>
                  edit_note
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Žádný úkol není vybraný
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Vyberte úkol ze seznamu nebo vytvořte nový.
              </p>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const isSaving = updateTask.isPending || deleteTask.isPending || createTask.isPending;

  const requestCloseDetail = () => {
    if (!onCloseDetail || isSaving) return;
    if (hasUnsavedChanges) {
      setIsCloseConfirmOpen(true);
      return;
    }
    onCloseDetail();
  };

  const saveTaskChanges = async (): Promise<boolean> => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Název úkolu je povinný.");
      return false;
    }

    const reminderChanged = reminderAt !== toDatetimeLocal(selectedTask.reminderAt);

    try {
      await updateTask.mutateAsync({
        id: selectedTask.id,
        input: {
          title: trimmedTitle,
          note: note.trim() || null,
          dueAt: datetimeLocalToIso(dueAt),
          reminderAt: reminderChanged ? datetimeLocalToIso(reminderAt) : undefined,
          priority: priority === "" ? null : priority,
          todoProjectId: isSubtask ? undefined : todoProjectId || null,
          projectId: projectId || null,
        },
      });
      setError(null);
      return true;
    } catch (err) {
      setError(getTaskMutationErrorMessage(err));
      return false;
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveTaskChanges();
  };

  const handleSaveAndClose = async () => {
    const saved = await saveTaskChanges();
    if (!saved) {
      setIsCloseConfirmOpen(false);
      return;
    }
    setIsCloseConfirmOpen(false);
    onCloseDetail?.();
  };

  const handleDiscardAndClose = () => {
    setIsCloseConfirmOpen(false);
    onCloseDetail?.();
  };

  const requestDelete = (task: Task, taskIsSubtask: boolean) => {
    setDeleteTarget({ task, isSubtask: taskIsSubtask });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    await deleteTask.mutateAsync(deleteTarget.task.id);
    if (deleteTarget.task.id === selectedTask.id) {
      onDeleted();
    }
    setDeleteTarget(null);
  };

  const handleRestoreFromArchive = async () => {
    await updateTask.mutateAsync({ id: selectedTask.id, input: { archivedAt: null } });
  };

  const setDetailReminderFromDue = (minutesBefore: number) => {
    setReminderAt(getReminderBefore(dueAt, minutesBefore));
  };

  const openSubtaskDialog = () => {
    setSubtaskError(null);
    setIsSubtaskDialogOpen(true);
  };

  const closeSubtaskDialog = () => {
    if (createTask.isPending) return;
    setIsSubtaskDialogOpen(false);
    setSubtaskError(null);
  };

  const handleCreateSubtask = async (draft: AddSubtaskDraft) => {
    const value = draft.title.trim();
    if (!value || createTask.isPending) return;

    try {
      await createTask.mutateAsync(buildSubtaskCreateInput(item.task, draft, item.subtasks.length));
      setIsSubtaskDialogOpen(false);
      setSubtaskError(null);
    } catch (err) {
      setSubtaskError(getTaskMutationErrorMessage(err));
    }
  };

  const handleRenameSubtask = async (subtask: Task) => {
    const value = (renamingSubtask[subtask.id] ?? "").trim();
    if (!value || value === subtask.title) return;
    await updateTask.mutateAsync({ id: subtask.id, input: { title: value } });
  };

  const moveSubtask = async (subtask: Task, direction: -1 | 1) => {
    const index = item.subtasks.findIndex((candidate) => candidate.id === subtask.id);
    const swap = item.subtasks[index + direction];
    if (!swap) return;
    await Promise.all([
      updateTask.mutateAsync({ id: subtask.id, input: { sortOrder: swap.sortOrder } }),
      updateTask.mutateAsync({ id: swap.id, input: { sortOrder: subtask.sortOrder } }),
    ]);
  };

  return (
    <>
      <aside
        data-help-id="tasks-detail"
        data-mobile-sheet={isMobileSheet ? "true" : "false"}
        className={
          isMobileSheet
            ? "h-[100dvh] max-h-[100dvh] min-h-0 overflow-y-auto rounded-none border-0 bg-white p-4 shadow-none dark:bg-slate-900"
            : "min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
        }
      >
        {onCloseDetail && (
          <button
            type="button"
            data-help-id="tasks-mobile-detail-close"
            onClick={requestCloseDetail}
            className="mb-3 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 lg:hidden"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              close
            </span>
            Zavřít detail
          </button>
        )}
        <form onSubmit={handleSave} className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {selectedTask.archivedAt ? "Archivovaný úkol" : isSubtask ? "Detail podúkolu" : "Detail úkolu"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {selectedTask.archivedAt
                ? "Mimo běžné pohledy a Command Center"
                : isSubtask
                  ? `Pod úkolem: ${item.task.title}`
                  : "Personal scope · props do Command Center"}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {selectedTask.archivedAt && (
              <Button type="button" variant="outline" size="sm" onClick={handleRestoreFromArchive}>
                Vrátit do Hotovo
              </Button>
            )}
            <Button
              type="button"
              variant={selectedTask.completed ? "outline" : "success"}
              size="sm"
              onClick={() => toggleTask.mutate({ id: selectedTask.id, completed: !selectedTask.completed })}
            >
              {selectedTask.completed ? "Znovu otevřít" : "Hotovo"}
            </Button>
          </div>
        </div>

        <Input label="Název" value={title} onChange={(event) => setTitle(event.target.value)} />

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Poznámka
          </label>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Termín
            </label>
            <TaskDateTimePicker
              label="Termín"
              value={dueAt}
              onChange={setDueAt}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Priorita
            </label>
            <select
              value={priority === "" ? "" : String(priority)}
              onChange={(event) =>
                setPriority(event.target.value === "" ? "" : (Number(event.target.value) as TaskPriority))
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Bez priority</option>
              <option value="1">P1 urgentní</option>
              <option value="2">P2 vysoká</option>
              <option value="3">P3 střední</option>
              <option value="4">P4 nízká</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Upozornění
          </label>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[210px] flex-1">
              <TaskDateTimePicker
                label="Upozornění"
                value={reminderAt}
                onChange={setReminderAt}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDetailReminderFromDue(0)}
              disabled={!dueAt}
            >
              V termínu
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDetailReminderFromDue(60)}
              disabled={!dueAt}
            >
              1 h před
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDetailReminderFromDue(24 * 60)}
              disabled={!dueAt}
            >
              Den před
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setReminderAt("")}
              disabled={!reminderAt}
            >
              Vypnout
            </Button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Upozornění vytvoří notifikaci v horním zvonku a podle nastavení také desktop upozornění.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            TODO projekt
          </label>
          <select
            value={todoProjectId}
            onChange={(event) => setTodoProjectId(event.target.value)}
            disabled={isSubtask}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Bez TODO projektu</option>
            {todoProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {isSubtask && (
            <p className="mt-1 text-xs text-slate-500">
              Podúkol drží TODO projekt podle hlavního úkolu.
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Kontext stavby
          </label>
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Bez stavby</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="flex justify-between gap-2">
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => requestDelete(selectedTask, isSubtask)}
            disabled={isSaving}
          >
            {isSubtask ? "Smazat podúkol" : "Smazat"}
          </Button>
          <Button type="submit" size="sm" isLoading={isSaving}>
            Uložit změny
          </Button>
        </div>
      </form>

      {!isSubtask && (
        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Podúkoly</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {getSubtaskProgress(item.subtasks).done}/{item.subtasks.length}
              </span>
              <Button type="button" size="sm" onClick={openSubtaskDialog}>
                Přidat podúkol
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {item.subtasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700">
                Zatím žádné podúkoly.
              </div>
            ) : (
              item.subtasks.map((subtask, index) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-800 dark:bg-slate-900/70"
                >
                  <button
                    type="button"
                    onClick={() => toggleTask.mutate({ id: subtask.id, completed: !subtask.completed })}
                    className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-[14px] ${
                      subtask.completed
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 hover:border-emerald-500 dark:border-slate-600"
                    }`}
                    aria-label={subtask.completed ? "Znovu otevřít podúkol" : "Označit podúkol jako hotový"}
                  >
                    <TaskCompletionMark completed={subtask.completed} />
                  </button>
                  <input
                    value={renamingSubtask[subtask.id] ?? subtask.title}
                    onChange={(event) =>
                      setRenamingSubtask((prev) => ({ ...prev, [subtask.id]: event.target.value }))
                    }
                    onBlur={() => handleRenameSubtask(subtask)}
                    className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${
                      subtask.completed
                        ? "text-slate-400 line-through"
                        : "text-slate-900 dark:text-slate-100"
                    }`}
                    aria-label="Název podúkolu"
                  />
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800"
                    onClick={() => onSelectTask(subtask.id)}
                    aria-label="Otevřít detail podúkolu"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit_note</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800"
                    onClick={() => moveSubtask(subtask, -1)}
                    disabled={index === 0}
                    aria-label="Posunout podúkol nahoru"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800"
                    onClick={() => moveSubtask(subtask, 1)}
                    disabled={index === item.subtasks.length - 1}
                    aria-label="Posunout podúkol dolů"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                  </button>
                  <button
                    type="button"
                  className="inline-flex size-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => requestDelete(subtask, true)}
                  aria-label="Smazat podúkol"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      </aside>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title={deleteTarget?.isSubtask ? "Smazat podúkol?" : "Smazat úkol?"}
        message={
          deleteTarget?.isSubtask
            ? `Podúkol "${deleteTarget.task.title}" bude trvale odstraněn.`
            : `Úkol "${deleteTarget?.task.title ?? ""}" bude trvale odstraněn včetně podúkolů.`
        }
        confirmLabel={deleteTarget?.isSubtask ? "Smazat podúkol" : "Smazat úkol"}
        cancelLabel="Zrušit"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />

      {isSubtaskDialogOpen && (
        <AddSubtaskDialog
          parentTask={item.task}
          dialogId={`detail-${item.task.id}`}
          error={subtaskError}
          isPending={createTask.isPending}
          onClose={closeSubtaskDialog}
          onSubmit={handleCreateSubtask}
        />
      )}

      {isCloseConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Neuložené změny"
          data-help-id="tasks-detail-unsaved-dialog"
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Neuložené změny
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Detail obsahuje změny. Chcete je před zavřením uložit, nebo je zahodit?
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsCloseConfirmOpen(false)}>
                Pokračovat v editaci
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleDiscardAndClose}>
                Zahodit změny
              </Button>
              <Button type="button" size="sm" onClick={handleSaveAndClose} isLoading={updateTask.isPending}>
                Uložit změny
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface TasksPageProps {
  skin?: ThemeSkin;
}

export const TasksPage: React.FC<TasksPageProps> = ({ skin = "classic" }) => {
  const [view, setView] = useState<TaskViewFilter>("inbox");
  const [selectedTodoProjectId, setSelectedTodoProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(() => new Set());
  const [isQuickAddExpanded, setIsQuickAddExpanded] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetTaskId, setDropTargetTaskId] = useState<string | null>(null);
  const [calendarDropTargetDayKey, setCalendarDropTargetDayKey] = useState<string | null>(null);
  const [calendarMode, setCalendarMode] = useState<TodoCalendarMode>("week");
  const [calendarCursorDate, setCalendarCursorDate] = useState(() => new Date());
  const [isDetailAutoSelectPaused, setIsDetailAutoSelectPaused] = useState(false);
  const isMobileLayout = useIsTasksMobileLayout();
  const tasksQuery = useTasksQuery({ includeArchived: true });
  const todoProjectsQuery = useTaskProjectsQuery();
  const updateTask = useUpdateTaskMutation();

  const taskTree = useMemo(() => buildTaskTree(tasksQuery.data ?? []), [tasksQuery.data]);
  const todoProjects = todoProjectsQuery.data ?? [];
  const selectedTodoProject = todoProjects.find((project) => project.id === selectedTodoProjectId);
  const visibleTree = useMemo(() => {
    if (selectedTodoProjectId) {
      return filterTaskTreeByTodoProject(taskTree, selectedTodoProjectId).filter(
        ({ task }) => !task.completed && !task.archivedAt,
      );
    }
    if (view === "calendar") {
      return taskTree.filter(
        ({ task, subtasks }) =>
          (!task.completed && !task.archivedAt) ||
          subtasks.some((subtask) => !subtask.completed && !subtask.archivedAt),
      );
    }
    if (view === "upcoming") {
      const agendaRootIds = new Set(
        buildUpcomingAgendaGroups(taskTree).flatMap((group) =>
          group.items.map((item) => item.rootTask.id),
        ),
      );
      return taskTree.filter(({ task }) => agendaRootIds.has(task.id));
    }
    return taskTree.filter(({ task }) => matchesTaskView(task, view));
  }, [selectedTodoProjectId, taskTree, view]);

  useEffect(() => {
    if (visibleTree.length === 0) {
      setSelectedTaskId(null);
      setIsDetailAutoSelectPaused(false);
      return;
    }
    if (isMobileLayout) {
      if (selectedTaskId && !findTaskSelection(visibleTree, selectedTaskId)) {
        setSelectedTaskId(null);
      }
      return;
    }
    if (!selectedTaskId || !findTaskSelection(visibleTree, selectedTaskId)) {
      if (!selectedTaskId && isDetailAutoSelectPaused) return;
      setSelectedTaskId(visibleTree[0].task.id);
    }
  }, [isDetailAutoSelectPaused, isMobileLayout, selectedTaskId, visibleTree]);

  const selectedSelection = findTaskSelection(visibleTree, selectedTaskId);
  const activeRootCount = taskTree.filter(({ task }) => !task.archivedAt).length;
  const listTitle = selectedTodoProject?.name ?? VIEW_LABELS[view].label;
  const canAddTask = Boolean(selectedTodoProjectId || view !== "archive");
  const mobileMenuLabel = selectedTodoProject?.name ?? VIEW_LABELS[view].label;
  const mobileMenuHint = selectedTodoProject ? "TODO projekt" : VIEW_LABELS[view].hint;
  const mobileMenuCount = selectedTodoProjectId
    ? getTodoProjectRootCount(taskTree, selectedTodoProjectId)
    : getViewCount(taskTree, view);
  const isMobileDetailActive = Boolean(isMobileLayout && selectedSelection);

  useEffect(() => {
    if (!canAddTask) {
      setIsQuickAddExpanded(false);
    }
  }, [canAddTask]);

  useEffect(() => {
    if (!isMobileLayout) {
      setIsMobileMenuOpen(true);
      return;
    }
    setIsMobileMenuOpen(false);
  }, [isMobileLayout]);

  const collapseMobileWorkspaces = () => {
    if (!isMobileLayout) return;
    setIsMobileMenuOpen(false);
    setIsQuickAddExpanded(false);
  };

  const handleSelectView = (item: TaskViewFilter) => {
    setSelectedTodoProjectId(null);
    setView(item);
    setIsDetailAutoSelectPaused(false);
    if (isMobileLayout) {
      setSelectedTaskId(null);
      collapseMobileWorkspaces();
    }
  };

  const handleSelectTodoProject = (projectId: string) => {
    setSelectedTodoProjectId(projectId);
    setSelectedTaskId(null);
    setIsDetailAutoSelectPaused(false);
    collapseMobileWorkspaces();
  };

  const handleSelectTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setIsDetailAutoSelectPaused(false);
    collapseMobileWorkspaces();
  };

  const handleCloseDetail = () => {
    setSelectedTaskId(null);
    setIsDetailAutoSelectPaused(true);
  };

  const toggleTaskExpanded = (taskId: string) => {
    setCollapsedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const clearDragState = () => {
    setDraggedTaskId(null);
    setDropTargetTaskId(null);
    setCalendarDropTargetDayKey(null);
  };

  const handleTaskDragStart = (taskId: string, event: React.DragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId);
    setDraggedTaskId(taskId);
    setDropTargetTaskId(null);
    setCalendarDropTargetDayKey(null);
  };

  const handleTaskDragOver = (targetTaskId: string, event: React.DragEvent<HTMLElement>) => {
    if (!draggedTaskId || draggedTaskId === targetTaskId) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetTaskId(targetTaskId);
  };

  const handleTaskDrop = async (targetTaskId: string, event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const sourceTaskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    if (!sourceTaskId || sourceTaskId === targetTaskId) {
      clearDragState();
      return;
    }

    const sourceIndex = visibleTree.findIndex(({ task }) => task.id === sourceTaskId);
    const targetIndex = visibleTree.findIndex(({ task }) => task.id === targetTaskId);
    if (sourceIndex < 0 || targetIndex < 0) {
      clearDragState();
      return;
    }

    const reordered = [...visibleTree];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    try {
      await Promise.all(
        reordered.map(({ task }, index) =>
          task.sortOrder === index
            ? Promise.resolve()
            : updateTask.mutateAsync({ id: task.id, input: { sortOrder: index } }),
        ),
      );
      setSelectedTaskId(sourceTaskId);
    } finally {
      clearDragState();
    }
  };

  const handleCalendarDayDragOver = (targetDay: Date, event: React.DragEvent<HTMLElement>) => {
    if (!draggedTaskId) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetTaskId(null);
    setCalendarDropTargetDayKey(localDateKey(targetDay));
  };

  const handleCalendarDayDrop = async (targetDay: Date, event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const sourceTaskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    if (!sourceTaskId) {
      clearDragState();
      return;
    }

    const selection = findTaskSelection(taskTree, sourceTaskId);
    const movedDueAt = moveDueAtToLocalDay(selection?.task.dueAt, targetDay);
    if (!selection || !movedDueAt) {
      clearDragState();
      return;
    }

    if (localDateKey(new Date(selection.task.dueAt ?? "")) === localDateKey(targetDay)) {
      setSelectedTaskId(sourceTaskId);
      clearDragState();
      return;
    }

    try {
      await updateTask.mutateAsync({ id: sourceTaskId, input: { dueAt: movedDueAt } });
      setSelectedTaskId(sourceTaskId);
    } finally {
      clearDragState();
    }
  };

  const handleTaskDeleted = (task: Task, isSubtask: boolean) => {
    if (isSubtask) {
      if (selectedTaskId === task.id) {
        setSelectedTaskId(selectedSelection?.item.task.id ?? null);
      }
      return;
    }

    if (selectedSelection?.item.task.id === task.id) {
      setSelectedTaskId(null);
    }
  };

  return (
    <div className="tf-tasks-view flex h-full min-h-0 flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header
        title="TODO Osobní"
        subtitle="Osobní úkoly, podúkoly a propis do Command Center"
        helpSlot={<HelpButton />}
        notificationSlot={<NotificationBell />}
        skin={skin}
      >
        <div className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 lg:block">
          Osobní · {activeRootCount} aktivních
        </div>
      </Header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-x-hidden overflow-y-auto p-4 lg:grid-cols-[260px_minmax(0,1fr)_380px] lg:overflow-hidden lg:p-6">
        <button
          type="button"
          data-help-id="tasks-mobile-menu-toggle"
          data-open={isMobileMenuOpen ? "true" : "false"}
          aria-controls="tasks-menu-panel"
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          className="flex min-w-0 self-start items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900/70 lg:hidden"
        >
          <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden>
            tune
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{mobileMenuLabel}</span>
            <span className="block truncate text-xs text-slate-500">{mobileMenuHint}</span>
          </span>
          <span className="text-xs text-slate-500">{mobileMenuCount}</span>
          <span
            className={`material-symbols-outlined text-[20px] text-slate-400 transition-transform ${isMobileMenuOpen ? "rotate-180" : ""}`}
            aria-hidden
          >
            expand_more
          </span>
        </button>
        <nav
          id="tasks-menu-panel"
          data-help-id="tasks-menu"
          data-mobile-open={isMobileMenuOpen ? "true" : "false"}
          className={`${isMobileMenuOpen ? "block" : "hidden"} max-h-[min(42dvh,360px)] min-h-0 self-start space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 lg:block lg:max-h-none lg:self-stretch lg:overflow-visible`}
        >
          {VIEW_ORDER.map((item) => {
            const meta = VIEW_LABELS[item];
            const active = !selectedTodoProjectId && view === item;
            return (
              <button
                key={item}
                type="button"
                data-active={active ? "true" : "false"}
                data-help-id="tasks-menu-item"
                aria-current={active ? "page" : undefined}
                onClick={() => handleSelectView(item)}
                className={`${TASK_MENU_ITEM_BASE} ${active ? TASK_MENU_ITEM_ACTIVE : TASK_MENU_ITEM_INACTIVE}`}
              >
                <span
                  data-help-id="tasks-menu-icon"
                  className={`material-symbols-outlined text-[20px] text-primary ${active ? "fill" : ""}`}
                  aria-hidden
                >
                  {meta.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{meta.label}</span>
                  <span className="block truncate text-xs text-slate-500">{meta.hint}</span>
                </span>
                <span className="text-xs text-slate-500">{getViewCount(taskTree, item)}</span>
              </button>
            );
          })}

          <TodoProjectSection
            projects={todoProjects}
            selectedTodoProjectId={selectedTodoProjectId}
            taskTree={taskTree}
            onSelectProject={handleSelectTodoProject}
            onProjectDeleted={(projectId) => {
              if (selectedTodoProjectId === projectId) {
                setSelectedTodoProjectId(null);
                setSelectedTaskId(null);
              }
            }}
          />
        </nav>

        <section
          data-help-id="tasks-list"
          data-mobile-hidden="false"
          data-mobile-detail-open={isMobileDetailActive ? "true" : "false"}
          className="min-h-0 min-w-0 space-y-3 overflow-hidden"
        >
          {canAddTask && (
            <QuickAdd
              currentView={view}
              todoProjectId={selectedTodoProjectId ?? undefined}
              todoProjects={todoProjects}
              onExpandedChange={setIsQuickAddExpanded}
            />
          )}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {listTitle}
            </h2>
            {tasksQuery.isFetching && <span className="text-xs text-slate-500">Obnovuji...</span>}
          </div>

          {tasksQuery.isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              Načítám úkoly...
            </div>
          ) : !selectedTodoProjectId && view === "calendar" ? (
            <TodoCalendarView
              tree={visibleTree}
              todoProjects={todoProjects}
              selectedTaskId={selectedTaskId}
              draggedTaskId={draggedTaskId}
              dropTargetDayKey={calendarDropTargetDayKey}
              mode={calendarMode}
              cursorDate={calendarCursorDate}
              onModeChange={setCalendarMode}
              onCursorChange={setCalendarCursorDate}
              onSelectTask={handleSelectTask}
              onTaskDragStart={handleTaskDragStart}
              onDayDragOver={handleCalendarDayDragOver}
              onDayDrop={handleCalendarDayDrop}
              onTaskDragEnd={clearDragState}
            />
          ) : !selectedTodoProjectId && view === "upcoming" ? (
            <TodoAgendaView
              tree={visibleTree}
              todoProjects={todoProjects}
              selectedTaskId={selectedTaskId}
              onSelectTask={handleSelectTask}
            />
          ) : visibleTree.length === 0 && canAddTask && isQuickAddExpanded ? (
            <div className="min-h-[96px]" aria-hidden />
          ) : visibleTree.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
              V tomhle pohledu zatím nic není.
            </div>
          ) : (
            <div className="max-h-full space-y-2 overflow-y-auto pr-1">
              {visibleTree.map((item) => (
                <TaskListItem
                  key={item.task.id}
                  item={item}
                  selected={selectedSelection?.item.task.id === item.task.id}
                  selectedTaskId={selectedTaskId}
                  isDragging={draggedTaskId === item.task.id}
                  isDropTarget={dropTargetTaskId === item.task.id}
                  onSelect={handleSelectTask}
                  onDeleted={handleTaskDeleted}
                  expanded={item.subtasks.length > 0 && !collapsedTaskIds.has(item.task.id)}
                  onToggleExpanded={toggleTaskExpanded}
                  onDragStart={handleTaskDragStart}
                  onDragOver={handleTaskDragOver}
                  onDrop={handleTaskDrop}
                  onDragEnd={clearDragState}
                />
              ))}
            </div>
          )}
        </section>

        {!isMobileLayout && (
          <TaskDetail
            item={selectedSelection?.item}
            selectedTask={selectedSelection?.task}
            todoProjects={todoProjects}
            isSubtask={selectedSelection?.isSubtask}
            isComposerActive={canAddTask && isQuickAddExpanded}
            onSelectTask={handleSelectTask}
            onDeleted={() => setSelectedTaskId(selectedSelection?.isSubtask ? selectedSelection.item.task.id : null)}
            onCloseDetail={handleCloseDetail}
          />
        )}
      </main>
      {isMobileDetailActive && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedSelection?.isSubtask ? "Detail podúkolu" : "Detail úkolu"}
          data-help-id="tasks-mobile-detail-sheet"
          className="fixed inset-0 z-[70] bg-slate-950/45 lg:hidden"
        >
          <div className="absolute inset-0" aria-hidden />
          <div className="relative h-full w-full">
            <TaskDetail
              item={selectedSelection?.item}
              selectedTask={selectedSelection?.task}
              todoProjects={todoProjects}
              isSubtask={selectedSelection?.isSubtask}
              isMobileSheet
              onSelectTask={handleSelectTask}
              onDeleted={() => setSelectedTaskId(selectedSelection?.isSubtask ? selectedSelection.item.task.id : null)}
              onCloseDetail={handleCloseDetail}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPage;
