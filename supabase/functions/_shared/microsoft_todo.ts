const GRAPH_ORIGIN = "https://graph.microsoft.com";
const GRAPH_BASE = `${GRAPH_ORIGIN}/v1.0`;
const MAX_DELTA_PAGES = 100;

export type GraphDateTimeTimeZone = {
  dateTime: string;
  timeZone: string;
};

export type GraphTodoTask = {
  id: string;
  title?: string;
  body?: { content?: string; contentType?: string } | null;
  dueDateTime?: GraphDateTimeTimeZone | null;
  reminderDateTime?: GraphDateTimeTimeZone | null;
  isReminderOn?: boolean;
  importance?: "low" | "normal" | "high" | string;
  status?: string;
  completedDateTime?: GraphDateTimeTimeZone | null;
  lastModifiedDateTime?: string;
  "@odata.etag"?: string;
  "@removed"?: { reason?: string };
};

export type GraphTodoList = {
  id: string;
  displayName: string;
};

export type GraphChecklistItem = {
  id: string;
  displayName?: string;
  isChecked?: boolean;
};

export const shouldApplyRemoteTask = (args: {
  localSyncStatus: string | null;
  localUpdatedAt: string;
  remoteUpdatedAt?: string | null;
}): boolean => {
  if (args.localSyncStatus !== "pending") return true;
  if (!args.remoteUpdatedAt) return false;
  const remoteTime = new Date(args.remoteUpdatedAt).getTime();
  const localTime = new Date(args.localUpdatedAt).getTime();
  if (!Number.isFinite(remoteTime) || !Number.isFinite(localTime)) return false;
  return remoteTime >= localTime;
};

type TenderFlowTaskRow = {
  title: string;
  note?: string | null;
  due_at?: string | null;
  reminder_at?: string | null;
  priority?: number | null;
  completed: boolean;
};

const toGraphDateTime = (value: string): GraphDateTimeTimeZone => ({
  dateTime: new Date(value).toISOString().replace(/Z$/, ""),
  timeZone: "UTC",
});

const fromGraphDateTime = (value: GraphDateTimeTimeZone | null | undefined): string | null => {
  if (!value?.dateTime) return null;
  const raw = value.dateTime.trim();
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/i.test(raw) ? raw : `${raw}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const toGraphImportance = (priority: number | null | undefined): "low" | "normal" | "high" => {
  if (priority === 1 || priority === 2) return "high";
  if (priority === 4) return "low";
  return "normal";
};

const fromGraphImportance = (importance: string | undefined): 2 | 3 | 4 => {
  if (importance === "high") return 2;
  if (importance === "low") return 4;
  return 3;
};

export const mapTenderFlowTaskToGraph = (task: TenderFlowTaskRow) => ({
  title: task.title.trim(),
  body: {
    content: task.note?.trim() || "",
    contentType: "text" as const,
  },
  dueDateTime: task.due_at ? toGraphDateTime(task.due_at) : null,
  reminderDateTime: task.reminder_at ? toGraphDateTime(task.reminder_at) : null,
  isReminderOn: Boolean(task.reminder_at),
  importance: toGraphImportance(task.priority),
  status: task.completed ? "completed" : "notStarted",
});

export const mapGraphTaskToTenderFlow = (task: GraphTodoTask) => ({
  externalId: task.id,
  externalEtag: task["@odata.etag"] ?? null,
  externalUpdatedAt: task.lastModifiedDateTime ?? null,
  title: task.title?.trim() || "Bez názvu",
  note: task.body?.contentType?.toLowerCase() === "text"
    ? task.body.content?.trim() || null
    : null,
  dueAt: fromGraphDateTime(task.dueDateTime),
  reminderAt: task.isReminderOn ? fromGraphDateTime(task.reminderDateTime) : null,
  priority: fromGraphImportance(task.importance),
  completed: task.status === "completed",
  completedAt: fromGraphDateTime(task.completedDateTime),
});

const graphHeaders = (accessToken: string, withJsonBody = false): HeadersInit => ({
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  prefer: 'outlook.timezone="UTC"',
  ...(withJsonBody ? { "content-type": "application/json" } : {}),
});

const graphError = (status: number): Error => {
  const error = new Error(`Microsoft Graph request failed (${status})`);
  return Object.assign(error, { status });
};

const fetchGraphWithRetry = async (url: string, init: RequestInit): Promise<Response> => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, init);
    if (![429, 503, 504].includes(response.status) || attempt === 2) return response;
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const delayMs = Number.isFinite(retryAfterSeconds)
      ? Math.min(5_000, Math.max(250, retryAfterSeconds * 1_000))
      : 250 * (attempt + 1);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error("Microsoft Graph retry loop ended unexpectedly");
};

export const microsoftGraphJson = async <T>(args: {
  accessToken: string;
  url: string;
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
}): Promise<T> => {
  const response = await fetchGraphWithRetry(args.url, {
    method: args.method ?? "GET",
    headers: graphHeaders(args.accessToken, args.body !== undefined),
    body: args.body === undefined ? undefined : JSON.stringify(args.body),
  });
  if (!response.ok) throw graphError(response.status);
  return await response.json() as T;
};

export const microsoftGraphDelete = async (args: {
  accessToken: string;
  url: string;
}): Promise<void> => {
  const response = await fetchGraphWithRetry(args.url, {
    method: "DELETE",
    headers: graphHeaders(args.accessToken),
  });
  if (!response.ok && response.status !== 404) throw graphError(response.status);
};

const assertSafeTodoDeltaUrl = (raw: string, listId: string): string => {
  const url = new URL(raw);
  const segments = url.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const validPath = segments.length === 7
    && segments[0] === "v1.0"
    && segments[1] === "me"
    && segments[2] === "todo"
    && segments[3] === "lists"
    && segments[4] === listId
    && segments[5] === "tasks"
    && segments[6] === "delta";
  if (url.protocol !== "https:" || url.origin !== GRAPH_ORIGIN || !validPath) {
    throw new Error("Unsafe Microsoft To Do delta URL");
  }
  return url.toString();
};

export const collectMicrosoftTodoDelta = async (args: {
  accessToken: string;
  listId: string;
  deltaLink?: string | null;
}): Promise<{ items: GraphTodoTask[]; deltaLink: string }> => {
  let pageUrl = args.deltaLink
    ? assertSafeTodoDeltaUrl(args.deltaLink, args.listId)
    : `${GRAPH_BASE}/me/todo/lists/${encodeURIComponent(args.listId)}/tasks/delta`;
  const seen = new Set<string>();
  const items: GraphTodoTask[] = [];

  for (let page = 0; page < MAX_DELTA_PAGES; page += 1) {
    if (seen.has(pageUrl)) throw new Error("Microsoft To Do delta pagination cycle");
    seen.add(pageUrl);

    const response = await microsoftGraphJson<{
      value?: GraphTodoTask[];
      "@odata.nextLink"?: string;
      "@odata.deltaLink"?: string;
    }>({ accessToken: args.accessToken, url: pageUrl });
    items.push(...(response.value ?? []));

    if (response["@odata.nextLink"]) {
      pageUrl = assertSafeTodoDeltaUrl(response["@odata.nextLink"], args.listId);
      continue;
    }
    const deltaLink = response["@odata.deltaLink"];
    if (!deltaLink) throw new Error("Microsoft To Do delta response is missing deltaLink");
    return { items, deltaLink: assertSafeTodoDeltaUrl(deltaLink, args.listId) };
  }

  throw new Error("Microsoft To Do delta pagination limit exceeded");
};

export const createMicrosoftTodoList = (accessToken: string, displayName: string) =>
  microsoftGraphJson<GraphTodoList>({
    accessToken,
    url: `${GRAPH_BASE}/me/todo/lists`,
    method: "POST",
    body: { displayName },
  });

export const renameMicrosoftTodoList = (accessToken: string, listId: string, displayName: string) =>
  microsoftGraphJson<GraphTodoList>({
    accessToken,
    url: `${GRAPH_BASE}/me/todo/lists/${encodeURIComponent(listId)}`,
    method: "PATCH",
    body: { displayName },
  });

export const createMicrosoftTodoTask = (accessToken: string, listId: string, task: TenderFlowTaskRow) =>
  microsoftGraphJson<GraphTodoTask>({
    accessToken,
    url: `${GRAPH_BASE}/me/todo/lists/${encodeURIComponent(listId)}/tasks`,
    method: "POST",
    body: mapTenderFlowTaskToGraph(task),
  });

export const updateMicrosoftTodoTask = (
  accessToken: string,
  listId: string,
  taskId: string,
  task: TenderFlowTaskRow,
) => microsoftGraphJson<GraphTodoTask>({
  accessToken,
  url: `${GRAPH_BASE}/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
  method: "PATCH",
  body: mapTenderFlowTaskToGraph(task),
});

export const deleteMicrosoftTodoTask = (accessToken: string, listId: string, taskId: string) =>
  microsoftGraphDelete({
    accessToken,
    url: `${GRAPH_BASE}/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
  });

export const listMicrosoftChecklistItems = (accessToken: string, listId: string, taskId: string) =>
  microsoftGraphJson<{ value?: GraphChecklistItem[] }>({
    accessToken,
    url: `${GRAPH_BASE}/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}/checklistItems`,
  }).then((response) => response.value ?? []);

export const createMicrosoftChecklistItem = (
  accessToken: string,
  listId: string,
  taskId: string,
  displayName: string,
  isChecked: boolean,
) => microsoftGraphJson<GraphChecklistItem>({
  accessToken,
  url: `${GRAPH_BASE}/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}/checklistItems`,
  method: "POST",
  body: { displayName, isChecked },
});

export const updateMicrosoftChecklistItem = (
  accessToken: string,
  listId: string,
  taskId: string,
  checklistItemId: string,
  displayName: string,
  isChecked: boolean,
) => microsoftGraphJson<GraphChecklistItem>({
  accessToken,
  url: `${GRAPH_BASE}/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}/checklistItems/${encodeURIComponent(checklistItemId)}`,
  method: "PATCH",
  body: { displayName, isChecked },
});

export const deleteMicrosoftChecklistItem = (
  accessToken: string,
  listId: string,
  taskId: string,
  checklistItemId: string,
) => microsoftGraphDelete({
  accessToken,
  url: `${GRAPH_BASE}/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}/checklistItems/${encodeURIComponent(checklistItemId)}`,
});
