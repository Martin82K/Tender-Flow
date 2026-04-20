import { dbAdapter } from "@/services/dbAdapter";
import type {
  Task,
  TaskCreateInput,
  TaskFilter,
  TaskUpdateInput,
} from "../types";

interface TaskRow {
  id: string;
  title: string;
  note: string | null;
  due_at: string | null;
  priority: number | null;
  project_id: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  completed: boolean;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  external_id: string | null;
  external_provider: string | null;
  external_url: string | null;
  last_synced_at: string | null;
  sync_status: string | null;
  sync_error: string | null;
}

const mapRow = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  note: row.note ?? undefined,
  dueAt: row.due_at ?? undefined,
  priority: (row.priority as Task["priority"]) ?? undefined,
  projectId: row.project_id ?? undefined,
  relatedEntity:
    row.related_entity_type && row.related_entity_id
      ? {
          type: row.related_entity_type as NonNullable<Task["relatedEntity"]>["type"],
          id: row.related_entity_id,
        }
      : undefined,
  completed: row.completed,
  completedAt: row.completed_at ?? undefined,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  externalId: row.external_id ?? undefined,
  externalProvider: (row.external_provider as Task["externalProvider"]) ?? undefined,
  externalUrl: row.external_url ?? undefined,
  lastSyncedAt: row.last_synced_at ?? undefined,
  syncStatus: (row.sync_status as Task["syncStatus"]) ?? undefined,
  syncError: row.sync_error ?? undefined,
});

export const listTasks = async (userId: string, filter?: TaskFilter): Promise<Task[]> => {
  let query = dbAdapter
    .from("tasks")
    .select("*")
    .eq("created_by", userId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filter?.completed !== undefined) {
    query = query.eq("completed", filter.completed);
  }
  if (filter?.projectId) {
    query = query.eq("project_id", filter.projectId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as TaskRow[]).map(mapRow);
};

export const createTask = async (
  userId: string,
  input: TaskCreateInput,
): Promise<Task> => {
  const payload = {
    title: input.title.trim(),
    note: input.note?.trim() || null,
    due_at: input.dueAt ?? null,
    priority: input.priority ?? null,
    project_id: input.projectId ?? null,
    related_entity_type: input.relatedEntity?.type ?? null,
    related_entity_id: input.relatedEntity?.id ?? null,
    created_by: userId,
  };

  const { data, error } = await dbAdapter
    .from("tasks")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data as TaskRow);
};

export const updateTask = async (
  id: string,
  input: TaskUpdateInput,
): Promise<Task> => {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.note !== undefined) patch.note = input.note === null ? null : input.note.trim() || null;
  if (input.dueAt !== undefined) patch.due_at = input.dueAt;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.projectId !== undefined) patch.project_id = input.projectId;
  if (input.relatedEntity !== undefined) {
    patch.related_entity_type = input.relatedEntity?.type ?? null;
    patch.related_entity_id = input.relatedEntity?.id ?? null;
  }
  if (input.completed !== undefined) patch.completed = input.completed;

  const { data, error } = await dbAdapter
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data as TaskRow);
};

export const deleteTask = async (id: string): Promise<void> => {
  const { error } = await dbAdapter.from("tasks").delete().eq("id", id);
  if (error) throw error;
};

export const setTaskCompleted = async (
  id: string,
  completed: boolean,
): Promise<Task> => updateTask(id, { completed });
