import React, { useEffect, useState } from "react";
import { Button } from "@shared/ui/Button";
import { useProjectsState } from "@features/projects/model/useProjectsState";
import { type TaskViewFilter } from "../model/taskTree";
import { useCreateTaskMutation } from "../hooks/useTaskMutations";
import { TaskDateTimePicker } from "./TaskDateTimePicker";
import type { TaskPriority, TodoProject } from "../types";
import { ThemedNativeSelect } from "@shared/ui/ThemedNativeSelect";
import { datetimeLocalToIso, getTaskMutationErrorMessage, getLocalDueAt, getReminderBefore, QUICK_ADD_SELECT_CLASS } from "./taskPresentation";

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
        <Button type="submit" size="sm" disabled={!title.trim()} isLoading={createTask.isPending} title="Rychle přidat úkol do osobního TODO">
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
            title="Nastavit termín úkolu na dnešek"
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Dnes
          </button>
          <button
            type="button"
            onClick={() => setQuickDue(1)}
            title="Nastavit termín úkolu na zítřek"
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Zítra
          </button>
          <button
            type="button"
            onClick={() => setQuickDue(7)}
            title="Nastavit termín úkolu na příští týden"
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
              aria-label="Priorita"
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
            title="Nastavit upozornění přesně na termín úkolu"
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Upozornit v termínu
          </button>
          <button
            type="button"
            onClick={() => setReminderFromDue(60)}
            disabled={!dueAt}
            title="Nastavit upozornění hodinu před termínem úkolu"
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            1 h před
          </button>
          <button
            type="button"
            onClick={() => setReminderFromDue(24 * 60)}
            disabled={!dueAt}
            title="Nastavit upozornění den před termínem úkolu"
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Den před
          </button>

          <label className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              tag
            </span>
            <ThemedNativeSelect
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
            </ThemedNativeSelect>
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
          <ThemedNativeSelect
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
          </ThemedNativeSelect>
        </label>

        <Button type="button" variant="secondary" size="sm" onClick={resetForm} title="Vyčistit rozpracovaný úkol a zavřít formulář">
          Zrušit
        </Button>
        <Button type="submit" size="sm" disabled={!title.trim()} isLoading={createTask.isPending} title="Přidat úkol do osobního TODO">
          Přidat úkol
        </Button>
      </div>
    </form>
  );
};
