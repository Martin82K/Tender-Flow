import React, { useMemo, useState } from "react";
import { type TaskWithSubtasks } from "../model/taskTree";
import { useCreateTaskMutation, useToggleTaskMutation } from "../hooks/useTaskMutations";
import type { Task, TodoProject } from "../types";
import { type TodoAgendaGroup, buildUpcomingAgendaGroups } from "./taskCalendarUtils";
import { priorityLabel, getTaskMutationErrorMessage, formatTime, formatDue, getDueTone, getPriorityTone, MetaBadge, TaskNotePreview, TaskCompletionMark } from "./taskPresentation";
import { type AddSubtaskDraft, buildSubtaskCreateInput, AddSubtaskDialog } from "./AddSubtaskDialog";

interface TodoAgendaViewProps {
  tree: TaskWithSubtasks[];
  todoProjects: TodoProject[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onOpenTaskEditor: (taskId: string) => void;
}

const TODO_AGENDA_TONE_CLASSES: Record<TodoAgendaGroup["tone"], string> = {
  overdue: "border-red-200 bg-red-50/70 text-red-700 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-300",
  today: "border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-300",
  future: "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200",
};

export const TodoAgendaView: React.FC<TodoAgendaViewProps> = ({
  tree,
  todoProjects,
  selectedTaskId,
  onSelectTask,
  onOpenTaskEditor,
}) => {
  const toggleTask = useToggleTaskMutation();
  const createTask = useCreateTaskMutation();
  const [subtaskDialogParent, setSubtaskDialogParent] = useState<Task | null>(null);
  const [subtaskError, setSubtaskError] = useState<string | null>(null);
  const groups = useMemo(() => buildUpcomingAgendaGroups(tree), [tree]);
  const subtaskCountByRootId = useMemo(
    () => new Map(tree.map((item) => [item.task.id, item.subtasks.length])),
    [tree],
  );
  const projectNameById = useMemo(
    () => new Map(todoProjects.map((project) => [project.id, project.name])),
    [todoProjects],
  );

  const openSubtaskDialog = (parentTask: Task) => {
    setSubtaskDialogParent(parentTask);
    setSubtaskError(null);
  };

  const closeSubtaskDialog = () => {
    if (createTask.isPending) return;
    setSubtaskDialogParent(null);
    setSubtaskError(null);
  };

  const handleCreateSubtask = async (draft: AddSubtaskDraft) => {
    if (!subtaskDialogParent || createTask.isPending) return;
    const value = draft.title.trim();
    if (!value) return;

    try {
      await createTask.mutateAsync(
        buildSubtaskCreateInput(
          subtaskDialogParent,
          draft,
          subtaskCountByRootId.get(subtaskDialogParent.id) ?? 0,
        ),
      );
      setSubtaskDialogParent(null);
      setSubtaskError(null);
    } catch (error) {
      setSubtaskError(getTaskMutationErrorMessage(error));
    }
  };

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
    <>
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
                  onDoubleClick={() => onOpenTaskEditor(task.id)}
                  className="group flex min-w-0 items-stretch gap-3 rounded-lg border border-slate-200/80 bg-white/85 px-3 py-2 text-slate-900 shadow-sm transition hover:border-primary/40 hover:bg-orange-50/55 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/25 data-[active=true]:border-primary data-[active=true]:bg-orange-50/80 data-[active=true]:ring-1 data-[active=true]:ring-primary/25 dark:border-slate-800 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:bg-orange-950/20 dark:data-[active=true]:bg-orange-950/30"
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={task.completed}
                    aria-label={task.completed ? "Znovu otevřít úkol" : "Označit úkol jako hotový"}
                    title={task.completed ? "Znovu otevřít tento úkol" : "Označit tento úkol jako hotový"}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleTask.mutate({ id: task.id, completed: !task.completed });
                    }}
                    className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[14px] ${
                      task.completed
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 bg-white/70 hover:border-emerald-500 dark:border-slate-600 dark:bg-slate-950/70"
                    }`}
                  >
                    <TaskCompletionMark completed={task.completed} />
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectTask(task.id)}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      onOpenTaskEditor(task.id);
                    }}
                    title={`Vybrat úkol "${task.title}". Dvojklik otevře detail.`}
                    className="min-w-0 flex-1 self-stretch rounded-md bg-transparent text-left outline-none focus:outline-none focus-visible:outline-none"
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
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openSubtaskDialog(rootTask);
                    }}
                    className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white/70 text-slate-500 shadow-sm transition hover:border-primary/40 hover:bg-white hover:text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-900"
                    aria-label={`Přidat podúkol k úkolu ${rootTask.title}`}
                    title={`Přidat podúkol k úkolu "${rootTask.title}"`}
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden>
                      add_task
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          </section>
        ))}
      </div>

      {subtaskDialogParent && (
        <AddSubtaskDialog
          parentTask={subtaskDialogParent}
          dialogId={`agenda-${subtaskDialogParent.id}`}
          error={subtaskError}
          isPending={createTask.isPending}
          onClose={closeSubtaskDialog}
          onSubmit={handleCreateSubtask}
        />
      )}
    </>
  );
};
