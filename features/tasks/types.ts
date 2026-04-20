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
  priority?: TaskPriority;
  projectId?: string;
  relatedEntity?: TaskRelatedEntity;
  completed: boolean;
  completedAt?: string;
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
  priority?: TaskPriority;
  projectId?: string;
  relatedEntity?: TaskRelatedEntity;
}

export interface TaskUpdateInput {
  title?: string;
  note?: string | null;
  dueAt?: string | null;
  priority?: TaskPriority | null;
  projectId?: string | null;
  relatedEntity?: TaskRelatedEntity | null;
  completed?: boolean;
}

export interface TaskFilter {
  completed?: boolean;
  projectId?: string;
}
