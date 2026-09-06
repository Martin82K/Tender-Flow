import React, { useEffect, useRef, useState } from "react";
import { ConfirmationModal } from "@shared/ui/ConfirmationModal";
import { getSubtaskProgress, type TaskWithSubtasks } from "../model/taskTree";
import { useCreateTaskMutation, useDeleteTaskMutation, useToggleTaskMutation } from "../hooks/useTaskMutations";
import type { Task } from "../types";
import { priorityLabel, getTaskMutationErrorMessage, formatDue, getDueTone, getPriorityTone, getSubtaskTone, MetaBadge, TaskNotePreview, TaskCompletionMark, formatArchivedAt } from "./taskPresentation";
import { type AddSubtaskDraft, buildSubtaskCreateInput, AddSubtaskDialog } from "./AddSubtaskDialog";

interface TaskListItemProps {
  item: TaskWithSubtasks;
  selected: boolean;
  selectedTaskId: string | null;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onSelect: (taskId: string) => void;
  onOpenTaskEditor: (taskId: string) => void;
  onDeleted: (task: Task, isSubtask: boolean) => void;
  expanded: boolean;
  onToggleExpanded: (taskId: string) => void;
  onDragStart: (taskId: string, event: React.DragEvent<HTMLElement>) => void;
  onDragOver: (taskId: string, event: React.DragEvent<HTMLElement>) => void;
  onDrop: (taskId: string, event: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

export const TaskListItem: React.FC<TaskListItemProps> = ({
  item,
  selected,
  selectedTaskId,
  isDragging = false,
  isDropTarget = false,
  onSelect,
  onOpenTaskEditor,
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
    onOpenTaskEditor(menuState.task.id);
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
          onDoubleClick={() => onOpenTaskEditor(item.task.id)}
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
            title={`Přetáhnout úkol "${item.task.title}" na jiné místo`}
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
            title={item.task.completed ? "Znovu otevřít tento úkol" : "Označit tento úkol jako hotový"}
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
            title={`Vybrat úkol "${item.task.title}"`}
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
                title={`Přidat podúkol k úkolu "${item.task.title}"`}
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
                title={expanded ? "Sbalit seznam podúkolů" : "Rozbalit seznam podúkolů"}
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
              title={`Přidat podúkol k úkolu "${item.task.title}"`}
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
                onDoubleClick={() => onOpenTaskEditor(subtask.id)}
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
                  title={subtask.completed ? "Znovu otevřít tento podúkol" : "Označit tento podúkol jako hotový"}
                >
                  <TaskCompletionMark completed={subtask.completed} />
                </button>
                <button
                  type="button"
                  onClick={() => onSelect(subtask.id)}
                  title={`Vybrat podúkol "${subtask.title}"`}
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
            title={menuState.isSubtask ? "Otevřít editační detail podúkolu" : "Otevřít editační detail úkolu"}
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
            title={menuState.isSubtask ? "Smazat vybraný podúkol" : "Smazat vybraný úkol"}
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
