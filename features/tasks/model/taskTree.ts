import type { Task } from "../types";

export interface TaskWithSubtasks {
  task: Task;
  subtasks: Task[];
}

export interface TaskSelection {
  item: TaskWithSubtasks;
  task: Task;
  isSubtask: boolean;
}

const compareTasks = (a: Task, b: Task): number => {
  const sort = a.sortOrder - b.sortOrder;
  if (sort !== 0) return sort;

  const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
  const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue - bDue;

  return b.createdAt.localeCompare(a.createdAt);
};

export const isSubtask = (task: Task): boolean => Boolean(task.parentTaskId);

export const isActiveRootTask = (task: Task): boolean =>
  !task.parentTaskId && !task.completed && !task.archivedAt;

export const buildTaskTree = (tasks: Task[]): TaskWithSubtasks[] => {
  const subtasksByParent = new Map<string, Task[]>();
  const roots: Task[] = [];

  for (const task of tasks) {
    if (task.parentTaskId) {
      const siblings = subtasksByParent.get(task.parentTaskId) ?? [];
      siblings.push(task);
      subtasksByParent.set(task.parentTaskId, siblings);
    } else {
      roots.push(task);
    }
  }

  return roots.sort(compareTasks).map((task) => ({
    task,
    subtasks: (subtasksByParent.get(task.id) ?? []).sort(compareTasks),
  }));
};

export const findTaskSelection = (
  tree: TaskWithSubtasks[],
  taskId: string | null | undefined,
): TaskSelection | undefined => {
  if (!taskId) return undefined;

  for (const item of tree) {
    if (item.task.id === taskId) {
      return { item, task: item.task, isSubtask: false };
    }

    const subtask = item.subtasks.find((candidate) => candidate.id === taskId);
    if (subtask) {
      return { item, task: subtask, isSubtask: true };
    }
  }

  return undefined;
};

export type TaskViewFilter =
  | "calendar"
  | "inbox"
  | "today"
  | "upcoming"
  | "important"
  | "completed"
  | "archive";

const startOfToday = (now: Date): Date => {
  const copy = new Date(now);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const startOfTomorrow = (now: Date): Date => {
  const copy = startOfToday(now);
  copy.setDate(copy.getDate() + 1);
  return copy;
};

export const matchesTaskView = (
  task: Task,
  view: TaskViewFilter,
  now: Date = new Date(),
): boolean => {
  if (view === "calendar") return !task.completed && !task.archivedAt && Boolean(task.dueAt);
  if (view === "archive") return Boolean(task.archivedAt);
  if (task.archivedAt) return false;
  if (view === "completed") return task.completed;
  if (task.completed) return false;

  if (view === "important") return task.priority === 1 || task.priority === 2;
  if (view === "inbox") return !task.dueAt && !task.projectId && !task.todoProjectId;

  if (!task.dueAt) return false;
  const due = new Date(task.dueAt);
  if (Number.isNaN(due.getTime())) return false;

  const today = startOfToday(now);
  const tomorrow = startOfTomorrow(now);

  if (view === "today") {
    return due >= today && due < tomorrow;
  }

  return due >= tomorrow;
};

export const getSubtaskProgress = (subtasks: Task[]): { done: number; total: number } => ({
  done: subtasks.filter((task) => task.completed).length,
  total: subtasks.length,
});

export const filterTaskTreeByTodoProject = (
  tree: TaskWithSubtasks[],
  todoProjectId: string | null | undefined,
): TaskWithSubtasks[] => {
  if (!todoProjectId) return tree;
  return tree.filter(({ task }) => task.todoProjectId === todoProjectId);
};

export const getTodoProjectRootCount = (
  tree: TaskWithSubtasks[],
  todoProjectId: string,
): number =>
  tree.filter(({ task }) => task.todoProjectId === todoProjectId && isActiveRootTask(task)).length;
