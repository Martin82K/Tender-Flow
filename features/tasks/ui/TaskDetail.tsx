import React, { useEffect, useState } from "react";
import { Button } from "@shared/ui/Button";
import { ConfirmationModal } from "@shared/ui/ConfirmationModal";
import { Input } from "@shared/ui/Input";
import { useTaskProjectOptions } from "../hooks/useTaskProjectOptions";
import { getSubtaskProgress, type TaskWithSubtasks } from "../model/taskTree";
import { useCreateTaskMutation, useDeleteTaskMutation, useToggleTaskMutation, useUpdateTaskMutation } from "../hooks/useTaskMutations";
import { TaskDateTimePicker } from "./TaskDateTimePicker";
import type { Task, TaskPriority, TodoProject } from "../types";
import { ThemedNativeSelect } from "@shared/ui/ThemedNativeSelect";
import { toDatetimeLocal, datetimeLocalToIso, getTaskMutationErrorMessage, getReminderBefore, TaskCompletionMark } from "./taskPresentation";
import { type AddSubtaskDraft, buildSubtaskCreateInput, AddSubtaskDialog } from "./AddSubtaskDialog";

interface TaskDetailProps {
  item?: TaskWithSubtasks;
  selectedTask?: Task;
  todoProjects: TodoProject[];
  isSubtask?: boolean;
  isComposerActive?: boolean;
  isMobileSheet?: boolean;
  isModal?: boolean;
  onSelectTask: (taskId: string) => void;
  onDeleted: () => void;
  onCloseDetail?: () => void;
}

export const TaskDetail: React.FC<TaskDetailProps> = ({
  item,
  selectedTask,
  todoProjects,
  isSubtask = false,
  isComposerActive = false,
  isMobileSheet = false,
  isModal = false,
  onSelectTask,
  onDeleted,
  onCloseDetail,
}) => {
  const projects = useTaskProjectOptions();
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
            : isModal
              ? "max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            : "min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
        }
      >
        <form onSubmit={handleSave} className="space-y-3">
        <div data-help-id="tasks-detail-header" className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {selectedTask.archivedAt ? "Archivovaný úkol" : isSubtask ? "Detail podúkolu" : "Detail úkolu"}
            </div>
            {isSubtask && <div className="mt-1 text-xs text-slate-500">Pod úkolem: {item.task.title}</div>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {selectedTask.archivedAt && (
              <Button type="button" variant="outline" size="sm" onClick={handleRestoreFromArchive} title="Vrátit archivovaný úkol zpět do Hotovo">
                Vrátit do Hotovo
              </Button>
            )}
            {onCloseDetail && (
              <button
                type="button"
                data-help-id="tasks-mobile-detail-close"
                onClick={requestCloseDetail}
                title="Zavřít detail úkolu"
                className={`relative z-10 inline-flex h-8 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-input bg-background px-3 text-xs font-medium text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-100/50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800/50 dark:hover:text-slate-100 ${
                  isModal ? "" : "lg:hidden"
                }`}
              >
                <span className="material-symbols-outlined pointer-events-none text-[18px]" aria-hidden>
                  close
                </span>
                Zavřít detail
              </button>
            )}
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
            <ThemedNativeSelect
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
            </ThemedNativeSelect>
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
              title="Nastavit upozornění přesně na termín úkolu"
            >
              V termínu
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDetailReminderFromDue(60)}
              disabled={!dueAt}
              title="Nastavit upozornění hodinu před termínem úkolu"
            >
              1 h před
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDetailReminderFromDue(24 * 60)}
              disabled={!dueAt}
              title="Nastavit upozornění den před termínem úkolu"
            >
              Den před
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setReminderAt("")}
              disabled={!reminderAt}
              title="Vypnout upozornění u úkolu"
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
          <ThemedNativeSelect
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
          </ThemedNativeSelect>
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
          <ThemedNativeSelect
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
          </ThemedNativeSelect>
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
            title={isSubtask ? "Smazat tento podúkol" : "Smazat tento úkol"}
          >
            {isSubtask ? "Smazat podúkol" : "Smazat"}
          </Button>
          <Button type="submit" size="sm" isLoading={isSaving} title="Uložit změny v detailu úkolu">
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
              <Button type="button" size="sm" onClick={openSubtaskDialog} title="Přidat nový podúkol k tomuto úkolu">
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
                    title={subtask.completed ? "Znovu otevřít tento podúkol" : "Označit tento podúkol jako hotový"}
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
                    title="Otevřít detail podúkolu"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit_note</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800"
                    onClick={() => moveSubtask(subtask, -1)}
                    disabled={index === 0}
                    aria-label="Posunout podúkol nahoru"
                    title="Posunout podúkol nahoru"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800"
                    onClick={() => moveSubtask(subtask, 1)}
                    disabled={index === item.subtasks.length - 1}
                    aria-label="Posunout podúkol dolů"
                    title="Posunout podúkol dolů"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                  </button>
                  <button
                    type="button"
                  className="inline-flex size-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => requestDelete(subtask, true)}
                  aria-label="Smazat podúkol"
                  title="Smazat podúkol"
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
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsCloseConfirmOpen(false)} title="Vrátit se zpět do editace detailu">
                Pokračovat v editaci
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleDiscardAndClose} title="Zahodit neuložené změny a zavřít detail">
                Zahodit změny
              </Button>
              <Button type="button" size="sm" onClick={handleSaveAndClose} isLoading={updateTask.isPending} title="Uložit změny a zavřít detail">
                Uložit změny
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
