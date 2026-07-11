import React, { useMemo, useState } from "react";
import type { ModuleProps } from "@features/command-center/types";
import { useDerivedActions } from "@features/command-center/hooks/useDerivedActions";
import { navigate } from "@shared/routing/router";
import { useAuthIdentity } from "@shared/auth/AuthIdentityContext";
import { useProjectPortfolioState } from "@features/projects/model/useProjectPortfolioState";
import {
  mergeActionQueue,
  useTasksQuery,
  useToggleTaskMutation,
  TaskFormModal,
  type ActionQueueItem,
  type Task,
} from "@features/tasks";

const severityBadgeClass: Record<string, string> = {
  critical: "cc-queue-num--red",
  warning: "cc-queue-num--amber",
  info: "cc-queue-num--blue",
};

const severityCheckClass: Record<string, string> = {
  critical: "cc-queue-check--red",
  warning: "cc-queue-check--amber",
  info: "cc-queue-check--blue",
};

const MAX_VISIBLE = 10;

const getTaskPriorityLabel = (item: ActionQueueItem): string | null => {
  if (item.kind !== "task" || !item.priority) return null;
  return `P${item.priority}`;
};

export const ActionQueueModule: React.FC<ModuleProps> = ({ filterState }) => {
  const derived = useDerivedActions(filterState);
  const user = useAuthIdentity();
  const tasksQuery = useTasksQuery({ user, filter: { completed: false } });
  const toggleTask = useToggleTaskMutation();
  const { projects } = useProjectPortfolioState();
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const projectNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) map[p.id] = p.name;
    return map;
  }, [projects]);

  const items = useMemo(
    () =>
      mergeActionQueue({
        derivedActions: derived,
        tasks: tasksQuery.data ?? [],
        projectNames,
      }).slice(0, MAX_VISIBLE),
    [derived, tasksQuery.data, projectNames],
  );

  const handleItemClick = (item: ActionQueueItem) => {
    if (item.kind === "task") {
      setEditingTask(item.source);
    } else if (item.actionUrl) {
      navigate(item.actionUrl);
    }
  };

  const handleToggleTask = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    toggleTask.mutate({ id: task.id, completed: !task.completed });
  };

  return (
    <div className="cc-panel">
      <div className="cc-panel__head">
        <span className="cc-panel__title cc-panel__title--amber">Akční fronta</span>
        <span className="cc-panel__meta">top {items.length}</span>
      </div>

      <div className="cc-panel__body cc-panel__body--flush">
        {items.length === 0 ? (
          <div className="cc-panel__empty">Žádné akce. Všechno je pod kontrolou.</div>
        ) : (
          <ol className="cc-queue" data-help-id="command-action-queue">
            {items.map((item, index) => {
              const priorityLabel = getTaskPriorityLabel(item);
              return (
                <li
                  key={item.id}
                  data-help-id="cc-queue-item"
                  data-kind={item.kind}
                  className={`cc-queue-item cc-queue-item--${item.kind}${item.kind === "task" ? ` cc-queue-item--urgency-${item.severity}` : ""}`}
                >
                  <button
                    type="button"
                    className="cc-queue-item__btn"
                    data-kind={item.kind}
                    onClick={() => handleItemClick(item)}
                  >
                    <span className="cc-queue-marker" aria-hidden={item.kind !== "task"}>
                      {item.kind === "task" ? (
                        <span
                          className={`cc-queue-check ${severityCheckClass[item.severity] ?? ""}`}
                          onClick={(e) => handleToggleTask(e, item.source)}
                          role="checkbox"
                          aria-checked="false"
                          aria-label="Označit úkol jako hotový"
                        >
                          <span className="material-symbols-outlined" aria-hidden>
                            check_box_outline_blank
                          </span>
                        </span>
                      ) : (
                        <span
                          className={`cc-queue-num ${severityBadgeClass[item.severity] ?? ""}`}
                          aria-hidden
                        >
                          {index + 1}
                        </span>
                      )}
                    </span>

                    <div className="cc-queue-item__body">
                      <div className="cc-queue-title-row">
                        <span className="cc-queue-title">{item.title}</span>
                        <span className={`cc-queue-kind cc-queue-kind--${item.kind}`}>
                          {item.kind === "task" ? "Úkol" : "Akce"}
                        </span>
                        {priorityLabel && <span className="cc-queue-priority">{priorityLabel}</span>}
                      </div>
                      {item.subtitle && <div className="cc-queue-sub">{item.subtitle}</div>}
                    </div>

                    <div className="cc-queue-meta" aria-label="Kontext akce">
                      {item.projectName && <span className="cc-queue-project">{item.projectName}</span>}
                      {item.dueAt && (
                        <span className="cc-queue-meta__d">{formatDueLabel(item.dueAt)}</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <TaskFormModal
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        task={editingTask ?? undefined}
      />
    </div>
  );
};

const formatDueLabel = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)} d po DDL`;
  if (diffDays === 0) return "dnes";
  if (diffDays === 1) return "zítra";
  return `${diffDays} d`;
};
