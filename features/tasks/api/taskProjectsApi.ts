import { dbAdapter } from "@infra/db/dbAdapter";
import type {
  TodoProject,
  TodoProjectCreateInput,
  TodoProjectUpdateInput,
} from "../types";

interface TodoProjectRow {
  id: string;
  name: string;
  color: string | null;
  sort_order: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const mapRow = (row: TodoProjectRow): TodoProject => ({
  id: row.id,
  name: row.name,
  color: row.color ?? undefined,
  sortOrder: row.sort_order ?? 0,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listTodoProjects = async (userId: string): Promise<TodoProject[]> => {
  const { data, error } = await dbAdapter
    .from("task_projects")
    .select("*")
    .eq("created_by", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as TodoProjectRow[]).map(mapRow);
};

export const createTodoProject = async (
  userId: string,
  input: TodoProjectCreateInput,
): Promise<TodoProject> => {
  const payload = {
    name: input.name.trim(),
    color: input.color ?? null,
    sort_order: input.sortOrder ?? 0,
    created_by: userId,
  };

  const { data, error } = await dbAdapter
    .from("task_projects")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data as TodoProjectRow);
};

export const updateTodoProject = async (
  id: string,
  input: TodoProjectUpdateInput,
): Promise<TodoProject> => {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.color !== undefined) patch.color = input.color;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  const { data, error } = await dbAdapter
    .from("task_projects")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data as TodoProjectRow);
};

export const deleteTodoProject = async (id: string): Promise<void> => {
  const { error } = await dbAdapter.from("task_projects").delete().eq("id", id);
  if (error) throw error;
};
