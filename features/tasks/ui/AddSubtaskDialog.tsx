import React, { useEffect, useRef, useState } from "react";
import { Button } from "@shared/ui/Button";
import { useTaskProjectOptions } from "../hooks/useTaskProjectOptions";
import { TaskDateTimePicker } from "./TaskDateTimePicker";
import type { Task, TaskCreateInput, TaskPriority } from "../types";
import { ThemedNativeSelect } from "@shared/ui/ThemedNativeSelect";
import { datetimeLocalToIso, getLocalDueAt, getReminderBefore, QUICK_ADD_SELECT_CLASS } from "./taskPresentation";

interface AddSubtaskDialogProps {
  parentTask: Task;
  dialogId: string;
  error: string | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (draft: AddSubtaskDraft) => void;
}

export interface AddSubtaskDraft {
  title: string;
  note: string;
  dueAt: string;
  reminderAt: string;
  priority: TaskPriority | "";
  projectId: string;
}

export const buildSubtaskCreateInput = (
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

export const AddSubtaskDialog: React.FC<AddSubtaskDialogProps> = ({
  parentTask,
  dialogId,
  error,
  isPending,
  onClose,
  onSubmit,
}) => {
  const projects = useTaskProjectOptions();
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
            title="Zavřít okno pro přidání podúkolu"
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
            title="Nastavit termín podúkolu na dnešek"
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Dnes
          </button>
          <button
            type="button"
            onClick={() => setQuickDue(1)}
            title="Nastavit termín podúkolu na zítřek"
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Zítra
          </button>
          <button
            type="button"
            onClick={() => setQuickDue(7)}
            title="Nastavit termín podúkolu na příští týden"
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Příští týden
          </button>
          <label className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              flag
            </span>
            <ThemedNativeSelect
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
            </ThemedNativeSelect>
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
            title="Nastavit upozornění přesně na termín podúkolu"
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Upozornit v termínu
          </button>
          <button
            type="button"
            onClick={() => setReminderFromDue(60)}
            disabled={!dueAt}
            title="Nastavit upozornění hodinu před termínem podúkolu"
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
            <ThemedNativeSelect
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
            </ThemedNativeSelect>
          </label>
        </div>
        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} title="Zrušit přidání podúkolu">
            Zrušit
          </Button>
          <Button type="submit" size="sm" disabled={!title.trim()} isLoading={isPending} title="Vytvořit nový podúkol">
            Přidat podúkol
          </Button>
        </div>
      </form>
    </div>
  );
};
