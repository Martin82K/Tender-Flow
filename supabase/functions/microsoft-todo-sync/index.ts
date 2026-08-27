import { buildCorsHeaders, handleCors } from "../_shared/cors.ts";
import {
  collectMicrosoftTodoDelta,
  createMicrosoftChecklistItem,
  createMicrosoftTodoList,
  createMicrosoftTodoTask,
  deleteMicrosoftChecklistItem,
  deleteMicrosoftTodoTask,
  listMicrosoftChecklistItems,
  mapGraphTaskToTenderFlow,
  renameMicrosoftTodoList,
  shouldApplyRemoteTask,
  updateMicrosoftChecklistItem,
  updateMicrosoftTodoTask,
  type GraphTodoTask,
} from "../_shared/microsoft_todo.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import { getAccessTokenForUser } from "../_shared/tokens.ts";

type ServiceClient = ReturnType<typeof createServiceClient>;

type TaskRow = {
  id: string;
  title: string;
  note: string | null;
  due_at: string | null;
  reminder_at: string | null;
  priority: number | null;
  todo_project_id: string | null;
  parent_task_id: string | null;
  sort_order: number;
  completed: boolean;
  completed_at: string | null;
  archived_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  external_id: string | null;
  external_provider: string | null;
  external_container_id: string | null;
  external_parent_id: string | null;
  external_etag: string | null;
  external_updated_at: string | null;
  sync_status: string | null;
};

type TodoProjectRow = {
  id: string;
  name: string;
};

type ListMappingRow = {
  id: string;
  user_id: string;
  todo_project_id: string | null;
  microsoft_list_id: string;
  display_name: string;
  delta_link: string | null;
  last_synced_at: string | null;
  sync_error: string | null;
};

type SyncCounts = {
  pulled: number;
  pushed: number;
  deleted: number;
  checklist: number;
};

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "content-type": "application/json" },
  });

const nowIso = () => new Date().toISOString();

const errorStatus = (cause: unknown): number | null =>
  typeof cause === "object" && cause !== null && "status" in cause
    ? Number((cause as { status?: unknown }).status) || null
    : null;

const safeSyncError = (cause: unknown): string => {
  const status = errorStatus(cause);
  return status ? `Microsoft Graph HTTP ${status}` : "Microsoft To Do synchronization failed";
};

const mappingKey = (todoProjectId: string | null) => todoProjectId ?? "__inbox__";

const microsoftListName = (project: TodoProjectRow | null): string =>
  (project ? `Tender Flow – ${project.name.trim()}` : "Tender Flow – Inbox").slice(0, 120);

const loadMappings = async (service: ServiceClient, userId: string): Promise<ListMappingRow[]> => {
  const { data, error } = await service
    .from("microsoft_todo_list_mappings")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as ListMappingRow[];
};

const ensureMappings = async (args: {
  service: ServiceClient;
  userId: string;
  accessToken: string;
}): Promise<ListMappingRow[]> => {
  const { data: projectData, error: projectError } = await args.service
    .from("task_projects")
    .select("id, name")
    .eq("created_by", args.userId)
    .order("sort_order", { ascending: true });
  if (projectError) throw projectError;

  const projects = (projectData ?? []) as TodoProjectRow[];
  const existing = await loadMappings(args.service, args.userId);
  const byProject = new Map(existing.map((mapping) => [mappingKey(mapping.todo_project_id), mapping]));
  const desired: Array<TodoProjectRow | null> = [null, ...projects];

  for (const project of desired) {
    const key = mappingKey(project?.id ?? null);
    const displayName = microsoftListName(project);
    const mapping = byProject.get(key);

    if (!mapping) {
      const remote = await createMicrosoftTodoList(args.accessToken, displayName);
      const { data, error } = await args.service
        .from("microsoft_todo_list_mappings")
        .insert({
          user_id: args.userId,
          todo_project_id: project?.id ?? null,
          microsoft_list_id: remote.id,
          display_name: remote.displayName || displayName,
        })
        .select("*")
        .single();
      if (error) throw error;
      byProject.set(key, data as ListMappingRow);
      continue;
    }

    if (mapping.display_name !== displayName && !mapping.sync_error) {
      const renamed = await renameMicrosoftTodoList(
        args.accessToken,
        mapping.microsoft_list_id,
        displayName,
      );
      const { data, error } = await args.service
        .from("microsoft_todo_list_mappings")
        .update({ display_name: renamed.displayName || displayName, sync_error: null })
        .eq("id", mapping.id)
        .eq("user_id", args.userId)
        .select("*")
        .single();
      if (error) throw error;
      byProject.set(key, data as ListMappingRow);
    }
  }

  return Array.from(byProject.values()).filter((mapping) =>
    desired.some((project) => mappingKey(project?.id ?? null) === mappingKey(mapping.todo_project_id))
  );
};

const clearAndDeleteLocalTask = async (service: ServiceClient, userId: string, taskId: string) => {
  const { error: clearError } = await service.from("tasks").update({
    external_id: null,
    external_provider: null,
    external_container_id: null,
    external_parent_id: null,
  }).eq("id", taskId).eq("created_by", userId);
  if (clearError) throw clearError;
  const { error: deleteError } = await service.from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("created_by", userId);
  if (deleteError) throw deleteError;
};

const remoteTaskPatch = (remote: GraphTodoTask, listId: string) => {
  const mapped = mapGraphTaskToTenderFlow(remote);
  return {
    title: mapped.title.slice(0, 500),
    note: mapped.note?.slice(0, 10_000) ?? null,
    due_at: mapped.dueAt,
    reminder_at: mapped.reminderAt,
    priority: mapped.priority,
    completed: mapped.completed,
    completed_at: mapped.completed ? mapped.completedAt || nowIso() : null,
    archived_at: mapped.completed ? undefined : null,
    external_id: mapped.externalId,
    external_provider: "ms-todo",
    external_container_id: listId,
    external_parent_id: null,
    external_etag: mapped.externalEtag,
    external_updated_at: mapped.externalUpdatedAt,
    last_synced_at: nowIso(),
    sync_status: "synced",
    sync_error: null,
  };
};

const pullMapping = async (args: {
  service: ServiceClient;
  userId: string;
  accessToken: string;
  mapping: ListMappingRow;
  counts: SyncCounts;
  checklistParents: Set<string>;
}) => {
  let delta;
  try {
    delta = await collectMicrosoftTodoDelta({
      accessToken: args.accessToken,
      listId: args.mapping.microsoft_list_id,
      deltaLink: args.mapping.delta_link,
    });
  } catch (cause) {
    if (errorStatus(cause) !== 410 || !args.mapping.delta_link) throw cause;
    delta = await collectMicrosoftTodoDelta({
      accessToken: args.accessToken,
      listId: args.mapping.microsoft_list_id,
    });
  }

  for (const remote of delta.items) {
    const { data: localData, error: localError } = await args.service
      .from("tasks")
      .select("*")
      .eq("created_by", args.userId)
      .eq("external_provider", "ms-todo")
      .eq("external_container_id", args.mapping.microsoft_list_id)
      .eq("external_id", remote.id)
      .is("parent_task_id", null)
      .maybeSingle();
    if (localError) throw localError;
    const local = localData as TaskRow | null;

    if (remote["@removed"]) {
      if (local) {
        await clearAndDeleteLocalTask(args.service, args.userId, local.id);
        args.counts.deleted += 1;
      }
      continue;
    }

    if (local && !shouldApplyRemoteTask({
      localSyncStatus: local.sync_status,
      localUpdatedAt: local.updated_at,
      remoteUpdatedAt: remote.lastModifiedDateTime,
    })) {
      args.checklistParents.add(local.id);
      continue;
    }

    const patch = remoteTaskPatch(remote, args.mapping.microsoft_list_id);
    if (local) {
      const { error } = await args.service.from("tasks")
        .update(patch)
        .eq("id", local.id)
        .eq("created_by", args.userId);
      if (error) throw error;
      args.checklistParents.add(local.id);
    } else {
      const { data, error } = await args.service.from("tasks").insert({
        ...patch,
        archived_at: null,
        todo_project_id: args.mapping.todo_project_id,
        parent_task_id: null,
        sort_order: 0,
        created_by: args.userId,
      }).select("id").single();
      if (error) throw error;
      args.checklistParents.add(data.id as string);
    }
    args.counts.pulled += 1;
  }

  const { error: mappingError } = await args.service
    .from("microsoft_todo_list_mappings")
    .update({ delta_link: delta.deltaLink, last_synced_at: nowIso(), sync_error: null })
    .eq("id", args.mapping.id)
    .eq("user_id", args.userId);
  if (mappingError) throw mappingError;
};

const markTaskSynced = async (args: {
  service: ServiceClient;
  userId: string;
  taskId: string;
  listId: string;
  remote: GraphTodoTask;
}) => {
  const { error } = await args.service.from("tasks").update({
    external_id: args.remote.id,
    external_provider: "ms-todo",
    external_container_id: args.listId,
    external_parent_id: null,
    external_etag: args.remote["@odata.etag"] ?? null,
    external_updated_at: args.remote.lastModifiedDateTime ?? nowIso(),
    last_synced_at: nowIso(),
    sync_status: "synced",
    sync_error: null,
  }).eq("id", args.taskId).eq("created_by", args.userId);
  if (error) throw error;
};

const pushRootTasks = async (args: {
  service: ServiceClient;
  userId: string;
  accessToken: string;
  mappings: ListMappingRow[];
  counts: SyncCounts;
  checklistParents: Set<string>;
}) => {
  const { data, error } = await args.service.from("tasks")
    .select("*")
    .eq("created_by", args.userId)
    .is("parent_task_id", null);
  if (error) throw error;

  const { data: subtaskData, error: subtaskError } = await args.service.from("tasks")
    .select("parent_task_id, external_id, external_container_id, external_parent_id, sync_status")
    .eq("created_by", args.userId)
    .not("parent_task_id", "is", null);
  if (subtaskError) throw subtaskError;
  const parentsWithDirtySubtasks = new Set(
    (subtaskData ?? [])
      .filter((subtask) => !subtask.external_id || subtask.sync_status !== "synced")
      .map((subtask) => subtask.parent_task_id as string),
  );

  const mappingByProject = new Map(
    args.mappings.filter((mapping) => !mapping.sync_error)
      .map((mapping) => [mappingKey(mapping.todo_project_id), mapping]),
  );

  for (const task of (data ?? []) as TaskRow[]) {
    if (task.external_provider && task.external_provider !== "ms-todo") continue;
    const mapping = mappingByProject.get(mappingKey(task.todo_project_id));
    if (!mapping) continue;

    try {
      let remoteId = task.external_id;
      if (remoteId && task.external_container_id !== mapping.microsoft_list_id) {
        if (task.external_container_id) {
          await deleteMicrosoftTodoTask(args.accessToken, task.external_container_id, remoteId);
        }
        remoteId = null;
      }

      let remote: GraphTodoTask | null = null;
      if (!remoteId) {
        remote = await createMicrosoftTodoTask(
          args.accessToken,
          mapping.microsoft_list_id,
          task,
        );
      } else if (task.sync_status !== "synced") {
        try {
          remote = await updateMicrosoftTodoTask(
            args.accessToken,
            mapping.microsoft_list_id,
            remoteId,
            task,
          );
        } catch (cause) {
          if (errorStatus(cause) !== 404) throw cause;
          remote = await createMicrosoftTodoTask(
            args.accessToken,
            mapping.microsoft_list_id,
            task,
          );
        }
      }

      if (remote) {
        await markTaskSynced({
          service: args.service,
          userId: args.userId,
          taskId: task.id,
          listId: mapping.microsoft_list_id,
          remote,
        });
        args.counts.pushed += 1;
      }
      if (remote || parentsWithDirtySubtasks.has(task.id)) {
        args.checklistParents.add(task.id);
      }
    } catch (cause) {
      await args.service.from("tasks").update({
        sync_status: "error",
        sync_error: safeSyncError(cause),
      }).eq("id", task.id).eq("created_by", args.userId);
    }
  }
};

const syncChecklistForParent = async (args: {
  service: ServiceClient;
  userId: string;
  accessToken: string;
  parentId: string;
  counts: SyncCounts;
}) => {
  const { data: parentData, error: parentError } = await args.service.from("tasks")
    .select("*")
    .eq("id", args.parentId)
    .eq("created_by", args.userId)
    .is("parent_task_id", null)
    .maybeSingle();
  if (parentError) throw parentError;
  const parent = parentData as TaskRow | null;
  if (!parent?.external_id || !parent.external_container_id) return;

  const [remoteItems, subtaskResult] = await Promise.all([
    listMicrosoftChecklistItems(
      args.accessToken,
      parent.external_container_id,
      parent.external_id,
    ),
    args.service.from("tasks")
      .select("*")
      .eq("created_by", args.userId)
      .eq("parent_task_id", parent.id)
      .order("sort_order", { ascending: true }),
  ]);
  if (subtaskResult.error) throw subtaskResult.error;
  const localItems = (subtaskResult.data ?? []) as TaskRow[];
  const localByExternalId = new Map(
    localItems.filter((item) => item.external_provider === "ms-todo" && item.external_id)
      .map((item) => [item.external_id as string, item]),
  );
  const remoteIds = new Set(remoteItems.map((item) => item.id));

  for (let index = 0; index < remoteItems.length; index += 1) {
    const remote = remoteItems[index];
    const local = localByExternalId.get(remote.id);
    if (local?.sync_status === "pending") continue;
    if (local) {
      const { error } = await args.service.from("tasks").update({
        title: (remote.displayName?.trim() || "Bez názvu").slice(0, 500),
        completed: Boolean(remote.isChecked),
        completed_at: remote.isChecked ? local.completed_at || nowIso() : null,
        archived_at: remote.isChecked ? undefined : null,
        sort_order: index,
        external_parent_id: parent.external_id,
        last_synced_at: nowIso(),
        sync_status: "synced",
        sync_error: null,
      }).eq("id", local.id).eq("created_by", args.userId);
      if (error) throw error;
    } else {
      const { error } = await args.service.from("tasks").insert({
        title: (remote.displayName?.trim() || "Bez názvu").slice(0, 500),
        todo_project_id: parent.todo_project_id,
        parent_task_id: parent.id,
        sort_order: index,
        completed: Boolean(remote.isChecked),
        completed_at: remote.isChecked ? nowIso() : null,
        created_by: args.userId,
        external_id: remote.id,
        external_provider: "ms-todo",
        external_container_id: parent.external_container_id,
        external_parent_id: parent.external_id,
        last_synced_at: nowIso(),
        sync_status: "synced",
      });
      if (error) throw error;
    }
    args.counts.checklist += 1;
  }

  for (const local of localItems) {
    if (
      local.external_id
      && local.external_provider === "ms-todo"
      && local.sync_status === "synced"
      && local.external_container_id === parent.external_container_id
      && local.external_parent_id === parent.external_id
      && !remoteIds.has(local.external_id)
    ) {
      await clearAndDeleteLocalTask(args.service, args.userId, local.id);
      args.counts.deleted += 1;
      continue;
    }

    if (local.external_provider && local.external_provider !== "ms-todo") continue;
    try {
      const needsCreate = !local.external_id
        || local.external_container_id !== parent.external_container_id
        || local.external_parent_id !== parent.external_id;
      const remote = needsCreate
        ? await createMicrosoftChecklistItem(
          args.accessToken,
          parent.external_container_id,
          parent.external_id,
          local.title,
          local.completed,
        )
        : local.sync_status !== "synced"
          ? await updateMicrosoftChecklistItem(
            args.accessToken,
            parent.external_container_id,
            parent.external_id,
            local.external_id as string,
            local.title,
            local.completed,
          )
          : null;
      if (!remote) continue;

      const { error } = await args.service.from("tasks").update({
        external_id: remote.id,
        external_provider: "ms-todo",
        external_container_id: parent.external_container_id,
        external_parent_id: parent.external_id,
        last_synced_at: nowIso(),
        sync_status: "synced",
        sync_error: null,
      }).eq("id", local.id).eq("created_by", args.userId);
      if (error) throw error;
      args.counts.checklist += 1;
    } catch (cause) {
      await args.service.from("tasks").update({
        sync_status: "error",
        sync_error: safeSyncError(cause),
      }).eq("id", local.id).eq("created_by", args.userId);
    }
  }
};

const flushTombstones = async (args: {
  service: ServiceClient;
  userId: string;
  accessToken: string;
  counts: SyncCounts;
}) => {
  const { data, error } = await args.service.from("microsoft_todo_tombstones")
    .select("id, microsoft_list_id, microsoft_task_id, microsoft_parent_task_id")
    .eq("user_id", args.userId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;

  for (const tombstone of data ?? []) {
    if (tombstone.microsoft_parent_task_id) {
      await deleteMicrosoftChecklistItem(
        args.accessToken,
        tombstone.microsoft_list_id,
        tombstone.microsoft_parent_task_id,
        tombstone.microsoft_task_id,
      );
    } else {
      await deleteMicrosoftTodoTask(
        args.accessToken,
        tombstone.microsoft_list_id,
        tombstone.microsoft_task_id,
      );
    }
    const { error: deleteError } = await args.service.from("microsoft_todo_tombstones")
      .delete()
      .eq("id", tombstone.id)
      .eq("user_id", args.userId);
    if (deleteError) throw deleteError;
    args.counts.deleted += 1;
  }
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const authed = createAuthedUserClient(req);
  const { data: userData, error: userError } = await authed.auth.getUser();
  if (userError || !userData.user) return json(req, 401, { error: "Unauthorized" });

  const service = createServiceClient();
  const userId = userData.user.id;
  const { data: acquired, error: lockError } = await service.rpc(
    "acquire_microsoft_todo_sync_lock",
    { target_user_id: userId },
  );
  if (lockError) return json(req, 500, { error: "Synchronization lock unavailable" });
  if (!acquired) return json(req, 202, { connected: true, busy: true });

  try {
    let accessToken: string;
    try {
      ({ accessToken } = await getAccessTokenForUser({
        userId,
        provider: "onedrive",
        accessKind: "todo_sync",
        fallbackAccessKind: "microsoft_graph",
      }));
    } catch {
      return json(req, 409, { connected: false, error: "Microsoft To Do is not connected" });
    }

    const counts: SyncCounts = { pulled: 0, pushed: 0, deleted: 0, checklist: 0 };
    const mappings = await ensureMappings({ service, userId, accessToken });
    await flushTombstones({ service, userId, accessToken, counts });

    const checklistParents = new Set<string>();
    for (const mapping of mappings) {
      if (mapping.sync_error) continue;
      try {
        await pullMapping({
          service,
          userId,
          accessToken,
          mapping,
          counts,
          checklistParents,
        });
      } catch (cause) {
        await service.from("microsoft_todo_list_mappings").update({
          sync_error: safeSyncError(cause),
        }).eq("id", mapping.id).eq("user_id", userId);
      }
    }

    const refreshedMappings = await loadMappings(service, userId);
    await pushRootTasks({
      service,
      userId,
      accessToken,
      mappings: refreshedMappings,
      counts,
      checklistParents,
    });

    for (const parentId of checklistParents) {
      try {
        await syncChecklistForParent({ service, userId, accessToken, parentId, counts });
      } catch (cause) {
        await service.from("tasks").update({
          sync_status: "error",
          sync_error: safeSyncError(cause),
        }).eq("id", parentId).eq("created_by", userId);
      }
    }

    return json(req, 200, { connected: true, busy: false, ...counts });
  } catch {
    return json(req, 502, { connected: true, error: "Microsoft To Do synchronization failed" });
  } finally {
    await service.rpc("release_microsoft_todo_sync_lock", { target_user_id: userId });
  }
});
