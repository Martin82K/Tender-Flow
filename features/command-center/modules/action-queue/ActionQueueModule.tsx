import React, { useMemo, useState } from "react";
import type { ModuleProps } from "@features/command-center/types";
import { useDerivedActions } from "@features/command-center/hooks/useDerivedActions";
import { navigate } from "@shared/routing/router";
import { useUI } from "@/context/UIContext";
import { useAppData } from "@/hooks/useAppData";
import {
  mergeActionQueue,
  useTasksQuery,
  useToggleTaskMutation,
  TaskQuickAdd,
  TaskFormModal,
  type ActionQueueItem,
  type Task,
} from "@features/tasks";

const severityBadgeClass: Record<string, string> = {
  critical: "cc-queue-num--red",
  warning: "cc-queue-num--amber",
  info: "cc-queue-num--blue",
};

const MAX_VISIBLE = 10;

export const ActionQueueModule: React.FC<ModuleProps> = ({ filterState }) => {
  const derived = useDerivedActions(filterState);
  const tasksQuery = useTasksQuery({ completed: false });
  const toggleTask = useToggleTaskMutation();
  const { showUiModal } = useUI();
  const { state } = useAppData(showUiModal);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const projectNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of state.projects) map[p.id] = p.name;
    return map;
  }, [state.projects]);

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
        <TaskQuickAdd />

        {items.length === 0 ? (
          <div className="cc-panel__empty">Žádné akce. Všechno je pod kontrolou.</div>
        ) : (
          <ol className="cc-queue">
            {items.map((item, index) => (
              <li key={item.id} className="cc-queue-item">
                <button
                  type="button"
                  className="cc-queue-item__btn"
                  onClick={() => handleItemClick(item)}
                >
                  {item.kind === "task" ? (
                    <span
                      className={`cc-queue-check ${severityBadgeClass[item.severity] ?? ""}`}
                      onClick={(e) => handleToggleTask(e, item.source)}
                      role="checkbox"
                      aria-checked="false"
                      aria-label="Označit úkol jako hotový"
                    >
                      {item.priority ? `P${item.priority}` : "·"}
                    </span>
                  ) : (
                    <span
                      className={`cc-queue-num ${severityBadgeClass[item.severity] ?? ""}`}
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                  )}

                  <div className="cc-queue-item__body">
                    <div className="cc-queue-title">
                      {item.kind === "task" && (
                        <span className="cc-queue-kind" aria-hidden>
                          ✎
                        </span>
                      )}
                      {item.title}
                    </div>
                    {item.subtitle && <div className="cc-queue-sub">{item.subtitle}</div>}
                  </div>

                  <div className="cc-queue-meta">
                    {item.projectName ?? ""}
                    {item.dueAt && (
                      <span className="cc-queue-meta__d">{formatDueLabel(item.dueAt)}</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
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
