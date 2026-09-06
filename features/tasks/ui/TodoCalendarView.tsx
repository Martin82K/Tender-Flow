import React, { useMemo, useRef } from "react";
import { type TaskWithSubtasks } from "../model/taskTree";
import { useToggleTaskMutation } from "../hooks/useTaskMutations";
import type { TodoProject } from "../types";
import { type TodoCalendarMode, type TodoCalendarTask, flattenCalendarTasks, startOfLocalDay, startOfLocalMonth, sameLocalDay, getDraggedTaskIdFromEvent, compareAgendaItems, localDateKey, getCalendarDays, shiftCalendarCursor, formatCalendarRange, TODO_PROJECT_COLORS, hexToRgba, getReadableTextColor, type TodoCalendarTaskStyle, getCalendarTaskProjectColor, getCalendarTaskProjectName } from "./taskCalendarUtils";
import { formatTime, MetaBadge, TaskCompletionMark } from "./taskPresentation";

interface TodoCalendarViewProps {
  tree: TaskWithSubtasks[];
  todoProjects: TodoProject[];
  selectedTaskId: string | null;
  mode: TodoCalendarMode;
  cursorDate: Date;
  onModeChange: (mode: TodoCalendarMode) => void;
  onCursorChange: (date: Date) => void;
  onSelectTask: (taskId: string) => void;
  onOpenTaskEditor: (taskId: string) => void;
  draggedTaskId: string | null;
  dropTargetDayKey: string | null;
  onTaskDragStart: (taskId: string, event: React.DragEvent<HTMLElement>) => void;
  onTaskDragEnd: () => void;
  onDayDragOver: (day: Date, event: React.DragEvent<HTMLElement>) => void;
  onDayDragLeave: (day: Date, event: React.DragEvent<HTMLElement>) => void;
  onDayDrop: (day: Date, event: React.DragEvent<HTMLElement>) => void;
}

const CALENDAR_MODE_LABELS: Record<TodoCalendarMode, string> = {
  month: "Měsíc",
  week: "Týden",
  "three-day": "3 dny",
  day: "Den",
};

export const TodoCalendarView: React.FC<TodoCalendarViewProps> = ({
  tree,
  todoProjects,
  selectedTaskId,
  mode,
  cursorDate,
  onModeChange,
  onCursorChange,
  onSelectTask,
  onOpenTaskEditor,
  draggedTaskId,
  dropTargetDayKey,
  onTaskDragStart,
  onTaskDragEnd,
  onDayDragOver,
  onDayDragLeave,
  onDayDrop,
}) => {
  const toggleTask = useToggleTaskMutation();
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
  const calendarScrollRef = useRef<HTMLDivElement | null>(null);

  const handleCalendarScrollDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!getDraggedTaskIdFromEvent(event, draggedTaskId)) return;
    const scrollContainer = calendarScrollRef.current;
    if (!scrollContainer) return;

    const rect = scrollContainer.getBoundingClientRect();
    const edgeSize = 64;
    const maxStep = 28;
    const distanceFromTop = event.clientY - rect.top;
    const distanceFromBottom = rect.bottom - event.clientY;
    const topRatio = Math.min(1, Math.max(0, (edgeSize - distanceFromTop) / edgeSize));
    const bottomRatio = Math.min(1, Math.max(0, (edgeSize - distanceFromBottom) / edgeSize));
    const topDelta = topRatio > 0 ? -Math.ceil(topRatio * maxStep) : 0;
    const bottomDelta = bottomRatio > 0 ? Math.ceil(bottomRatio * maxStep) : 0;
    const nextDelta = topDelta || bottomDelta;

    if (nextDelta !== 0) {
      scrollContainer.scrollBy({ top: nextDelta, behavior: "auto" });
    }
  };

  return (
    <div
      data-help-id="tasks-calendar"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
    >
      <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
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
              data-help-id="todo-calendar-mode"
              data-active={mode === item ? "true" : "false"}
              onClick={() => onModeChange(item)}
              title={`Přepnout kalendář na zobrazení: ${CALENDAR_MODE_LABELS[item]}`}
              className={`h-7 rounded-md border px-2 text-xs font-semibold transition ${
                mode === item
                  ? "border-orange-600 bg-orange-500 text-white shadow-sm hover:bg-orange-600 hover:text-white dark:border-orange-500 dark:bg-orange-500 dark:text-white"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
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
            title="Přejít na předchozí období kalendáře"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              chevron_left
            </span>
          </button>
          <button
            type="button"
            onClick={() => onCursorChange(new Date())}
            title="Přejít v kalendáři na dnešní datum"
            className="h-8 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Dnes
          </button>
          <button
            type="button"
            onClick={() => onCursorChange(shiftCalendarCursor(mode, cursorDate, 1))}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Další období"
            title="Přejít na další období kalendáře"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              chevron_right
            </span>
          </button>
        </div>
      </div>

      <div
        ref={calendarScrollRef}
        data-help-id="todo-calendar-scroll"
        onDragOver={handleCalendarScrollDragOver}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div
          className={`grid min-h-[480px] ${compact ? "grid-cols-7" : ""}`}
          style={compact ? undefined : { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
        >
          {days.map((day) => {
            const key = localDateKey(day);
            const tasks = tasksByDay.get(key) ?? [];
            const outsideMonth = compact && day.getMonth() !== monthCursor.getMonth();
            const isToday = sameLocalDay(day, today);
            const isDropTarget = dropTargetDayKey === key;
            return (
              <div
                key={key}
                data-date={key}
                data-drop-target={isDropTarget ? "true" : "false"}
                data-help-id="todo-calendar-day"
                data-today={isToday ? "true" : "false"}
                onDragOver={(event) => {
                  handleCalendarScrollDragOver(event);
                  onDayDragOver(day, event);
                }}
                onDragLeave={(event) => onDayDragLeave(day, event)}
                onDrop={(event) => onDayDrop(day, event)}
                className={`min-h-[118px] border-r border-b border-slate-200 p-2 transition last:border-r-0 data-[drop-target=true]:bg-primary/10 data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-inset data-[drop-target=true]:ring-primary/30 dark:border-slate-800 ${
                  outsideMonth ? "bg-slate-50/70 text-slate-400 dark:bg-slate-950/30" : ""
                } ${isToday ? "tf-todo-calendar-day--today" : ""}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div
                    data-help-id="todo-calendar-day-heading"
                    className={`inline-flex flex-col rounded-md px-1.5 py-0.5 ${
                      isToday ? "tf-todo-calendar-day-heading--today" : ""
                    }`}
                  >
                    <div className="tf-todo-calendar-day-weekday text-[11px] font-semibold uppercase text-slate-500">
                      {day.toLocaleDateString("cs-CZ", { weekday: "short" })}
                    </div>
                    <div className="tf-todo-calendar-day-date text-sm font-bold text-slate-900 dark:text-slate-100">
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
                  const cardClassName = `relative w-full cursor-grab overflow-hidden rounded-lg border px-2 py-1.5 pr-7 text-left text-xs shadow-sm outline-none transition hover:-translate-y-px active:cursor-grabbing focus:ring-2 focus:ring-offset-1 data-[active=true]:shadow-md data-[dragging=true]:opacity-55 ${
                    compact ? "max-h-36" : ""
                  }`;

                  return (
                    <div
                      key={task.id}
                      data-active={selectedTaskId === task.id ? "true" : "false"}
                      data-dragging={draggedTaskId === task.id ? "true" : "false"}
                      data-has-project={assignedProjectColor ? "true" : "false"}
                      data-help-id="todo-calendar-task"
                      draggable
                      onDragStart={(event) => onTaskDragStart(task.id, event)}
                      onDragEnd={onTaskDragEnd}
                      className={cardClassName}
                      style={cardStyle}
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={task.completed}
                        aria-label={task.completed ? `Znovu otevřít úkol ${task.title}` : `Označit úkol ${task.title} jako hotový`}
                        title={task.completed ? `Znovu otevřít úkol "${task.title}"` : `Označit úkol "${task.title}" jako hotový`}
                        draggable={false}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleTask.mutate({ id: task.id, completed: !task.completed });
                        }}
                        onDoubleClick={(event) => event.stopPropagation()}
                        className="absolute right-1.5 top-1.5 z-[2] inline-flex size-4 shrink-0 items-center justify-center rounded border bg-white/75 text-[11px] font-bold shadow-sm transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-white/80"
                        style={{
                          borderColor: mutedTextColor,
                          color: textColor,
                        }}
                      >
                        <TaskCompletionMark completed={task.completed} />
                      </button>
                      <button
                        type="button"
                        data-help-id="todo-calendar-task-action"
                        onClick={() => onSelectTask(task.id)}
                        onDoubleClick={() => onOpenTaskEditor(task.id)}
                        title={`Vybrat úkol "${task.title}". Dvojklik otevře detail.`}
                        className="relative z-[1] block w-full min-w-0 overflow-hidden rounded-md bg-transparent text-left outline-none focus:ring-2 focus:ring-white/80"
                        style={{ color: "var(--todo-card-text)" }}
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
                            className="mt-1 block text-[11px] leading-snug"
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: compact ? 4 : 2,
                              WebkitBoxOrient: "vertical",
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
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
};
