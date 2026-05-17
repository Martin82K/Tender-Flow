export type TaskPriority = 1 | 2 | 3 | 4;

export type TaskRelatedEntityType = "category" | "bid" | "contract" | "document";

export interface TaskRelatedEntity {
  type: TaskRelatedEntityType;
  id: string;
}

export type TaskExternalProvider =
  | "todoist"
  | "ms-todo"
  | "apple-reminders"
  | "google-tasks";

export type TaskSyncStatus = "synced" | "pending" | "error";

export interface Task {
  id: string;
  title: string;
  note?: string;
  dueAt?: string;
  reminderAt?: string;
  reminderSentAt?: string;
  priority?: TaskPriority;
  todoProjectId?: string;
  projectId?: string;
  relatedEntity?: TaskRelatedEntity;
  parentTaskId?: string;
  sortOrder: number;
  completed: boolean;
  completedAt?: string;
  archivedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;

  externalId?: string;
  externalProvider?: TaskExternalProvider;
  externalUrl?: string;
  lastSyncedAt?: string;
  syncStatus?: TaskSyncStatus;
  syncError?: string;
}

export interface TaskCreateInput {
  title: string;
  note?: string;
  dueAt?: string;
  reminderAt?: string;
  priority?: TaskPriority;
  todoProjectId?: string;
  projectId?: string;
  relatedEntity?: TaskRelatedEntity;
  parentTaskId?: string;
  sortOrder?: number;
}

export interface TaskUpdateInput {
  title?: string;
  note?: string | null;
  dueAt?: string | null;
  reminderAt?: string | null;
  priority?: TaskPriority | null;
  todoProjectId?: string | null;
  projectId?: string | null;
  relatedEntity?: TaskRelatedEntity | null;
  parentTaskId?: string | null;
  sortOrder?: number;
  completed?: boolean;
  archivedAt?: string | null;
}

export interface TaskFilter {
  completed?: boolean;
  todoProjectId?: string;
  projectId?: string;
  parentTaskId?: string | null;
  rootOnly?: boolean;
  archived?: boolean;
  includeArchived?: boolean;
}

export interface TodoProject {
  id: string;
  name: string;
  color?: string;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TodoProjectCreateInput {
  name: string;
  color?: string;
  sortOrder?: number;
}

export interface TodoProjectUpdateInput {
  name?: string;
  color?: string | null;
  sortOrder?: number;
}
