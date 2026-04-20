import type {
  CommandCenterSeverity,
  DerivedAction,
} from "@features/command-center/types";
import type { Task, TaskPriority } from "../types";

export type ActionQueueItemKind = "derived" | "task";

interface BaseItem {
  id: string;
  severity: CommandCenterSeverity;
  title: string;
  subtitle?: string;
  projectId?: string;
  projectName?: string;
  dueAt?: string;
  actionUrl?: string;
}

export interface DerivedActionQueueItem extends BaseItem {
  kind: "derived";
  projectId: string;
  source: DerivedAction;
}

export interface TaskQueueItem extends BaseItem {
  kind: "task";
  priority?: TaskPriority;
  source: Task;
}

export type ActionQueueItem = DerivedActionQueueItem | TaskQueueItem;

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const SEVERITY_ORDER: Record<CommandCenterSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const daysFromNow = (iso: string, now: Date): number => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((d.getTime() - now.getTime()) / MS_PER_DAY);
};

/**
 * Určí severity user tasku podle deadline a priority.
 *
 * Overdue (dueAt v minulosti) → critical.
 * Dnes/zítra a priority 1 (urgent) → critical.
 * Do 3 dnů a priority ≤ 2 → warning. Samotná priority 1 bez deadline → warning.
 * Ostatní → info.
 */
export const classifyTaskSeverity = (
  task: Task,
  now: Date = new Date(),
): CommandCenterSeverity => {
  if (task.dueAt) {
    const days = daysFromNow(task.dueAt, now);
    if (days < 0) return "critical";
    if (days <= 1 && task.priority === 1) return "critical";
    if (days <= 3 && (task.priority === 1 || task.priority === 2)) return "warning";
    if (days <= 1) return "warning";
  } else if (task.priority === 1) {
    return "warning";
  }
  return "info";
};

const derivedToItem = (action: DerivedAction): DerivedActionQueueItem => ({
  kind: "derived",
  id: `derived:${action.id}`,
  severity: action.severity,
  title: action.title,
  subtitle: action.subtitle,
  projectId: action.projectId,
  projectName: action.projectName,
  dueAt: action.dueAt,
  actionUrl: action.actionUrl,
  source: action,
});

const taskToItem = (
  task: Task,
  projectName: string | undefined,
  now: Date,
): TaskQueueItem => ({
  kind: "task",
  id: `task:${task.id}`,
  severity: classifyTaskSeverity(task, now),
  title: task.title,
  subtitle: task.note && task.note.length > 0 ? task.note.split("\n")[0] : undefined,
  projectId: task.projectId,
  projectName,
  dueAt: task.dueAt,
  priority: task.priority,
  source: task,
});

export interface MergeInput {
  derivedActions: DerivedAction[];
  tasks: Task[];
  projectNames?: Record<string, string>;
  now?: Date;
}

export const mergeActionQueue = ({
  derivedActions,
  tasks,
  projectNames = {},
  now = new Date(),
}: MergeInput): ActionQueueItem[] => {
  const items: ActionQueueItem[] = [
    ...derivedActions.map(derivedToItem),
    ...tasks
      .filter((t) => !t.completed)
      .map((t) => taskToItem(t, t.projectId ? projectNames[t.projectId] : undefined, now)),
  ];

  return items.sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;

    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;

    // Uvnitř stejného koše: user tasky dál s prioritou (1 = urgent) před info derived.
    const aPrio = a.kind === "task" ? (a.priority ?? 5) : 5;
    const bPrio = b.kind === "task" ? (b.priority ?? 5) : 5;
    return aPrio - bPrio;
  });
};
