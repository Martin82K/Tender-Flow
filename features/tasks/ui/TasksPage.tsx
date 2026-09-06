import React, { useEffect, useMemo, useState } from "react";
import { ConfirmationModal } from "@shared/ui/ConfirmationModal";
import { Header } from "@shared/ui/Header";
import { HelpButton } from "@features/help";
import { NotificationBell } from "@features/notifications/ui/NotificationBell";
import { useAuthIdentity, type AuthIdentity } from "@shared/auth/AuthIdentityContext";
import type { ThemeSkin } from "@/shared/types/theme";
import { buildTaskTree, filterTaskTreeByTodoProject, findTaskSelection, getTodoProjectRootCount, matchesTaskView, type TaskViewFilter, type TaskWithSubtasks } from "../model/taskTree";
import { useTaskProjectsQuery } from "../hooks/useTaskProjectsQuery";
import { useDeleteCompletedTasksMutation, useUpdateTaskMutation } from "../hooks/useTaskMutations";
import { useTasksQuery } from "../hooks/useTasksQuery";
import { useMicrosoftTodoSync } from "../hooks/useMicrosoftTodoSync";
import type { Task } from "../types";
import { useIsTasksMobileLayout } from "./useIsTasksMobileLayout";
import { type TodoCalendarMode, TASK_DRAG_DATA_TYPE, flattenCalendarTasks, sameLocalDay, moveDueAtToLocalDay, hasTaskDragPayload, getDraggedTaskIdFromEvent, localDateKey, buildUpcomingAgendaGroups } from "./taskCalendarUtils";
import { TASK_MENU_ITEM_BASE, TASK_MENU_ITEM_ACTIVE, TASK_MENU_ITEM_INACTIVE } from "./taskPresentation";
import { QuickAdd } from "./QuickAdd";
import { TaskListItem } from "./TaskListItem";
import { TodoCalendarView } from "./TodoCalendarView";
import { TodoAgendaView } from "./TodoAgendaView";
import { TodoProjectSection } from "./TodoProjectSection";
import { TaskDetail } from "./TaskDetail";

const VIEW_LABELS: Record<TaskViewFilter, { label: string; icon: string; hint: string }> = {
  calendar: { label: "Kalendář", icon: "calendar_month", hint: "Měsíc, týden, 3 dny nebo den" },
  inbox: { label: "Inbox", icon: "inbox", hint: "Rychlý záchyt bez termínu" },
  today: { label: "Dnes", icon: "today", hint: "Co má být hotové dnes" },
  upcoming: { label: "Nadcházející", icon: "event_upcoming", hint: "Plán podle termínu" },
  important: { label: "Důležité", icon: "flag", hint: "Priority P1 a P2" },
  completed: { label: "Hotovo", icon: "task_alt", hint: "Automaticky se smažou po 14 dnech" },
  archive: { label: "Archiv", icon: "inventory_2", hint: "Ručně archivované úkoly" },
};

const VIEW_ORDER: TaskViewFilter[] = ["calendar", "inbox", "today", "upcoming", "important", "completed", "archive"];

const getViewCount = (tree: TaskWithSubtasks[], view: TaskViewFilter): number =>
  view === "calendar"
    ? flattenCalendarTasks(tree).length
    : view === "upcoming"
      ? buildUpcomingAgendaGroups(tree).reduce((total, group) => total + group.items.length, 0)
    : tree.filter(({ task }) => matchesTaskView(task, view)).length;

interface TasksPageProps {
  skin?: ThemeSkin;
  initialTaskId?: string;
  onCloseInitialTask?: () => void;
}

export const TasksPage: React.FC<TasksPageProps> = (props) => {
  const user = useAuthIdentity();
  const [routeState, setRouteState] = useState<{
    taskId?: string;
    consumedTaskId?: string;
    revision: number;
  }>({ taskId: props.initialTaskId, revision: 0 });
  if (routeState.taskId !== props.initialTaskId) {
    // Clearing a consumed link acknowledges a manual choice; a new route starts fresh.
    const consumed = !props.initialTaskId && routeState.consumedTaskId === routeState.taskId;
    setRouteState({ taskId: props.initialTaskId, revision: routeState.revision + (consumed ? 0 : 1) });
  }
  const consumeInitialTask = () => {
    setRouteState(current => ({ ...current, consumedTaskId: props.initialTaskId }));
    props.onCloseInitialTask?.();
  };
  return <TasksWorkspace key={JSON.stringify([user?.id, user?.role, routeState.revision])}
    {...props} user={user} onCloseInitialTask={consumeInitialTask} />;
};

const TasksWorkspace: React.FC<TasksPageProps & { user: AuthIdentity | null }> = ({
  skin = "classic",
  initialTaskId,
  onCloseInitialTask,
  user,
}) => {
  const [view, setView] = useState<TaskViewFilter>("calendar");
  const [selectedTodoProjectId, setSelectedTodoProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTaskId ?? null);
  const [isTaskEditorOpen, setIsTaskEditorOpen] = useState(Boolean(initialTaskId));
  const [isLinkedTaskEditor, setIsLinkedTaskEditor] = useState(Boolean(initialTaskId));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(() => new Set());
  const [isQuickAddExpanded, setIsQuickAddExpanded] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetTaskId, setDropTargetTaskId] = useState<string | null>(null);
  const [dropTargetCalendarDayKey, setDropTargetCalendarDayKey] = useState<string | null>(null);
  const [calendarMode, setCalendarMode] = useState<TodoCalendarMode>("day");
  const [calendarCursorDate, setCalendarCursorDate] = useState(() => new Date());
  const [isDetailAutoSelectPaused, setIsDetailAutoSelectPaused] = useState(false);
  const [isDeleteCompletedOpen, setIsDeleteCompletedOpen] = useState(false);
  const [deleteCompletedError, setDeleteCompletedError] = useState<string | null>(null);
  const isMobileLayout = useIsTasksMobileLayout();
  const tasksQuery = useTasksQuery({ user, filter: { includeArchived: true } });
  const todoProjectsQuery = useTaskProjectsQuery({ user });
  const updateTask = useUpdateTaskMutation();
  const deleteCompletedTasks = useDeleteCompletedTasksMutation();
  const microsoftTodoSync = useMicrosoftTodoSync();

  const tasks = useMemo(
    () => user && user.role !== "demo"
      ? (tasksQuery.data ?? []).filter((task) => task.createdBy === user.id)
      : [],
    [tasksQuery.data, user?.id, user?.role],
  );
  const taskTree = useMemo(() => buildTaskTree(tasks), [tasks]);
  const projectTaskIds = new Set(tasks.filter((task) => task.projectId).map((task) => task.id));
  const personalParentIdsWithProjectChildren = new Set(
    tasks
      .filter((task) => task.projectId && task.parentTaskId)
      .map((task) => task.parentTaskId as string),
  );
  const completedTaskCount = tasks.filter(
    (task) =>
      task.completed &&
      !task.projectId &&
      (!task.parentTaskId || !projectTaskIds.has(task.parentTaskId)) &&
      !personalParentIdsWithProjectChildren.has(task.id),
  ).length;
  const todoProjects = useMemo(
    () => user && user.role !== "demo"
      ? (todoProjectsQuery.data ?? []).filter((project) => project.createdBy === user.id)
      : [],
    [todoProjectsQuery.data, user?.id, user?.role],
  );
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
    // Linked tasks (including archived tasks and subtasks) may be outside the current view.
    if (isLinkedTaskEditor && isTaskEditorOpen) return;
    if (visibleTree.length === 0) {
      setSelectedTaskId(null);
      setIsDetailAutoSelectPaused(false);
      setIsTaskEditorOpen(false);
      return;
    }
    if (selectedTaskId && !findTaskSelection(visibleTree, selectedTaskId)) {
      setSelectedTaskId(null);
      setIsTaskEditorOpen(false);
    }
  }, [isLinkedTaskEditor, isTaskEditorOpen, selectedTaskId, visibleTree]);

  const selectedSelection = findTaskSelection(isLinkedTaskEditor ? taskTree : visibleTree, selectedTaskId);
  const isLinkedTaskUnavailable = initialTaskId && !tasksQuery.isLoading && !tasksQuery.isFetching
    && !findTaskSelection(taskTree, initialTaskId);
  const activeRootCount = taskTree.filter(({ task }) => !task.archivedAt).length;
  const listTitle = selectedTodoProject?.name ?? VIEW_LABELS[view].label;
  const canAddTask = Boolean(selectedTodoProjectId || view !== "archive");
  const mobileMenuLabel = selectedTodoProject?.name ?? VIEW_LABELS[view].label;
  const mobileMenuHint = selectedTodoProject ? "TODO projekt" : VIEW_LABELS[view].hint;
  const mobileMenuCount = selectedTodoProjectId
    ? getTodoProjectRootCount(taskTree, selectedTodoProjectId)
    : getViewCount(taskTree, view);
  const isMobileDetailActive = Boolean(isMobileLayout && isTaskEditorOpen && selectedSelection);

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

  const consumeInitialTask = () => {
    if (initialTaskId) onCloseInitialTask?.();
  };

  const handleSelectView = (item: TaskViewFilter) => {
    consumeInitialTask();
    setIsLinkedTaskEditor(false);
    setSelectedTodoProjectId(null);
    setView(item);
    setIsTaskEditorOpen(false);
    setIsDetailAutoSelectPaused(false);
    if (isMobileLayout) {
      setSelectedTaskId(null);
      collapseMobileWorkspaces();
    }
  };

  const handleSelectTodoProject = (projectId: string) => {
    consumeInitialTask();
    setIsLinkedTaskEditor(false);
    setSelectedTodoProjectId(projectId);
    setSelectedTaskId(null);
    setIsTaskEditorOpen(false);
    setIsDetailAutoSelectPaused(false);
    collapseMobileWorkspaces();
  };

  const handleSelectTask = (taskId: string) => {
    consumeInitialTask();
    setSelectedTaskId(taskId);
    if (isMobileLayout) {
      setIsTaskEditorOpen(true);
    }
    setIsDetailAutoSelectPaused(false);
    collapseMobileWorkspaces();
  };

  const handleOpenTaskEditor = (taskId: string) => {
    consumeInitialTask();
    setSelectedTaskId(taskId);
    setIsTaskEditorOpen(true);
    setIsDetailAutoSelectPaused(false);
    collapseMobileWorkspaces();
  };

  const handleCloseDetail = () => {
    consumeInitialTask();
    setIsLinkedTaskEditor(false);
    setSelectedTaskId(null);
    setIsTaskEditorOpen(false);
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
    setDropTargetCalendarDayKey(null);
  };

  const handleTaskDragStart = (taskId: string, event: React.DragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(TASK_DRAG_DATA_TYPE, taskId);
    event.dataTransfer.setData("text/plain", taskId);
    setDraggedTaskId(taskId);
    setDropTargetTaskId(null);
    setDropTargetCalendarDayKey(null);
  };

  const handleTaskDragOver = (targetTaskId: string, event: React.DragEvent<HTMLElement>) => {
    if (!draggedTaskId || draggedTaskId === targetTaskId) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetTaskId(targetTaskId);
  };

  const handleTaskDrop = async (targetTaskId: string, event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const sourceTaskId = getDraggedTaskIdFromEvent(event, draggedTaskId);
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

  const handleCalendarDayDragOver = (day: Date, event: React.DragEvent<HTMLElement>) => {
    if (!draggedTaskId && !hasTaskDragPayload(event.dataTransfer)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetTaskId(null);
    setDropTargetCalendarDayKey(localDateKey(day));
  };

  const handleCalendarDayDragLeave = (day: Date, event: React.DragEvent<HTMLElement>) => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;

    setDropTargetCalendarDayKey((current) => (current === localDateKey(day) ? null : current));
  };

  const handleCalendarDayDrop = async (day: Date, event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const sourceTaskId = getDraggedTaskIdFromEvent(event, draggedTaskId);
    if (!sourceTaskId) {
      clearDragState();
      return;
    }

    const calendarTask = flattenCalendarTasks(visibleTree).find(({ task }) => task.id === sourceTaskId);
    if (!calendarTask) {
      clearDragState();
      return;
    }

    const nextDueAt = moveDueAtToLocalDay(calendarTask.task.dueAt, day);
    const currentDueAt = calendarTask.task.dueAt ? new Date(calendarTask.task.dueAt) : null;
    if (!nextDueAt || (currentDueAt && !Number.isNaN(currentDueAt.getTime()) && sameLocalDay(currentDueAt, day))) {
      clearDragState();
      return;
    }

    try {
      await updateTask.mutateAsync({ id: sourceTaskId, input: { dueAt: nextDueAt } });
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

  const handleDeleteCompletedTasks = async () => {
    if (deleteCompletedTasks.isPending) return;
    try {
      await deleteCompletedTasks.mutateAsync();
      setDeleteCompletedError(null);
      setSelectedTaskId(null);
      setIsTaskEditorOpen(false);
      setIsDeleteCompletedOpen(false);
    } catch {
      setIsDeleteCompletedOpen(false);
      setDeleteCompletedError(
        "Hotové osobní úkoly se nepodařilo vymazat. Zkuste akci znovu.",
      );
    }
  };

  return (
    <div className="tf-tasks-view flex h-full min-h-0 flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header
        title="TODO Osobní"
        subtitle="Osobní úkoly, podúkoly, připomínky a kalendář"
        helpSlot={<HelpButton />}
        notificationSlot={<NotificationBell />}
        skin={skin}
      >
        <div className="hidden items-center gap-2 lg:flex">
          {microsoftTodoSync.connected ? (
            <button
              type="button"
              onClick={() => void microsoftTodoSync.syncNow()}
              disabled={microsoftTodoSync.isSyncing}
              title={microsoftTodoSync.syncError
                ? microsoftTodoSync.syncError
                : microsoftTodoSync.lastSyncedAt
                  ? `Naposledy synchronizováno ${new Date(microsoftTodoSync.lastSyncedAt).toLocaleString("cs-CZ")}`
                  : "Synchronizovat s Microsoft To Do"}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300"
            >
              {microsoftTodoSync.isSyncing ? "Synchronizuji…" : "Microsoft To Do"}
            </button>
          ) : null}
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
            Osobní · {activeRootCount} aktivních
          </div>
        </div>
      </Header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-x-hidden overflow-y-auto p-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:overflow-hidden lg:p-6">
        <button
          type="button"
          data-help-id="tasks-mobile-menu-toggle"
          data-open={isMobileMenuOpen ? "true" : "false"}
          aria-controls="tasks-menu-panel"
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          title={isMobileMenuOpen ? "Sbalit TODO menu" : "Rozbalit TODO menu"}
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
                title={`${meta.label}: ${meta.hint}`}
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
          className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden"
        >
          {canAddTask && (
            <QuickAdd
              currentView={view}
              todoProjectId={selectedTodoProjectId ?? undefined}
              todoProjects={todoProjects}
              onExpandedChange={setIsQuickAddExpanded}
            />
          )}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {listTitle}
            </h2>
            <div className="flex items-center gap-2">
              {!selectedTodoProjectId && view === "completed" && completedTaskCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteCompletedError(null);
                    setIsDeleteCompletedOpen(true);
                  }}
                  disabled={deleteCompletedTasks.isPending}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-wait disabled:opacity-60 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300"
                >
                  Vymazat vše hotové
                </button>
              )}
              {tasksQuery.isFetching && <span className="text-xs text-slate-500">Obnovuji...</span>}
            </div>
          </div>

          {deleteCompletedError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300"
            >
              {deleteCompletedError}
            </p>
          )}

          {isLinkedTaskUnavailable && (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {tasksQuery.isError
                ? "Úkol se nepodařilo načíst. Zkuste stránku obnovit."
                : "Úkol není dostupný. Byl odstraněn nebo k němu nemáte přístup."}
            </p>
          )}

          {tasksQuery.isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              Načítám úkoly...
            </div>
          ) : !selectedTodoProjectId && view === "calendar" ? (
            <TodoCalendarView
              tree={visibleTree}
              todoProjects={todoProjects}
              selectedTaskId={selectedTaskId}
              mode={calendarMode}
              cursorDate={calendarCursorDate}
              onModeChange={setCalendarMode}
              onCursorChange={setCalendarCursorDate}
              onSelectTask={handleSelectTask}
              onOpenTaskEditor={handleOpenTaskEditor}
              draggedTaskId={draggedTaskId}
              dropTargetDayKey={dropTargetCalendarDayKey}
              onTaskDragStart={handleTaskDragStart}
              onTaskDragEnd={clearDragState}
              onDayDragOver={handleCalendarDayDragOver}
              onDayDragLeave={handleCalendarDayDragLeave}
              onDayDrop={handleCalendarDayDrop}
            />
          ) : !selectedTodoProjectId && view === "upcoming" ? (
            <TodoAgendaView
              tree={visibleTree}
              todoProjects={todoProjects}
              selectedTaskId={selectedTaskId}
              onSelectTask={handleSelectTask}
              onOpenTaskEditor={handleOpenTaskEditor}
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
                  onOpenTaskEditor={handleOpenTaskEditor}
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

      </main>
      {!isMobileLayout && isTaskEditorOpen && selectedSelection && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedSelection.isSubtask ? "Detail podúkolu" : "Detail úkolu"}
          data-help-id="tasks-detail-modal"
          className="fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-[640px]">
            <TaskDetail
              item={selectedSelection.item}
              selectedTask={selectedSelection.task}
              todoProjects={todoProjects}
              isSubtask={selectedSelection.isSubtask}
              isModal
              onSelectTask={handleOpenTaskEditor}
              onDeleted={() => {
                setSelectedTaskId(selectedSelection.isSubtask ? selectedSelection.item.task.id : null);
                setIsTaskEditorOpen(false);
              }}
              onCloseDetail={handleCloseDetail}
            />
          </div>
        </div>
      )}
      {isMobileLayout && isTaskEditorOpen && selectedSelection && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedSelection.isSubtask ? "Detail podúkolu" : "Detail úkolu"}
          data-help-id="tasks-mobile-detail-sheet"
          className="fixed inset-0 z-[70] bg-slate-950/45 lg:hidden"
        >
          <div className="absolute inset-0" aria-hidden />
          <div className="relative h-full w-full">
            <TaskDetail
              item={selectedSelection.item}
              selectedTask={selectedSelection.task}
              todoProjects={todoProjects}
              isSubtask={selectedSelection.isSubtask}
              isMobileSheet
              onSelectTask={handleOpenTaskEditor}
              onDeleted={() => {
                setSelectedTaskId(selectedSelection.isSubtask ? selectedSelection.item.task.id : null);
                setIsTaskEditorOpen(false);
              }}
              onCloseDetail={handleCloseDetail}
            />
          </div>
        </div>
      )}
      <ConfirmationModal
        isOpen={isDeleteCompletedOpen}
        title="Vymazat vše hotové?"
        message={`Trvale odstraníte ${completedTaskCount} ${completedTaskCount === 1 ? "hotový úkol" : "hotových úkolů"}. Aktivní podúkoly zůstanou zachované jako samostatné úkoly. Tuto akci nelze vrátit zpět.`}
        confirmLabel="Vymazat vše hotové"
        cancelLabel="Zrušit"
        onConfirm={() => void handleDeleteCompletedTasks()}
        onCancel={() => setIsDeleteCompletedOpen(false)}
      />
    </div>
  );
};

export default TasksPage;

// Preserve the existing public exports while implementation lives in focused modules.
export { QuickAdd } from "./QuickAdd";
export { TodoProjectSection } from "./TodoProjectSection";
export { buildUpcomingAgendaGroups } from "./taskCalendarUtils";
