import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectMicrosoftTodoDelta,
  isActiveGraphTodoTask,
  isActiveTenderFlowTask,
  mapGraphTaskToTenderFlow,
  mapTenderFlowTaskToGraph,
  shouldApplyRemoteTask,
} from "../supabase/functions/_shared/microsoft_todo.ts";

describe("Microsoft To Do Graph mapping", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps Tender Flow fields to the writable Graph todoTask shape", () => {
    expect(mapTenderFlowTaskToGraph({
      title: "Odeslat nabídku",
      note: "Zkontrolovat výkaz výměr",
      due_at: "2026-09-01T14:30:00.000Z",
      reminder_at: "2026-09-01T12:00:00.000Z",
      priority: 1,
      completed: true,
    })).toEqual({
      title: "Odeslat nabídku",
      body: { content: "Zkontrolovat výkaz výměr", contentType: "text" },
      dueDateTime: { dateTime: "2026-09-01T14:30:00.000", timeZone: "UTC" },
      reminderDateTime: { dateTime: "2026-09-01T12:00:00.000", timeZone: "UTC" },
      isReminderOn: true,
      importance: "high",
      status: "completed",
    });
  });

  it("neexportuje dokončené ani archivované Tender Flow úkoly", () => {
    expect(isActiveTenderFlowTask({ completed: false, archived_at: null })).toBe(true);
    expect(isActiveTenderFlowTask({ completed: true, archived_at: null })).toBe(false);
    expect(isActiveTenderFlowTask({ completed: false, archived_at: "2026-08-28T06:00:00Z" })).toBe(false);
  });

  it("neimportuje dokončené Microsoft To Do úkoly jako nové aktivní úkoly", () => {
    expect(isActiveGraphTodoTask({ id: "active", status: "notStarted" })).toBe(true);
    expect(isActiveGraphTodoTask({ id: "completed", status: "completed" })).toBe(false);
    expect(isActiveGraphTodoTask({ id: "removed", "@removed": { reason: "deleted" } })).toBe(false);
  });

  it("u úkolu navázaného na stavbu zachová termín, ale vypne Outlook upozornění", () => {
    expect(mapTenderFlowTaskToGraph({
      title: "Odeslat poptávku",
      due_at: "2026-09-01T14:30:00.000Z",
      reminder_at: "2026-09-01T12:00:00.000Z",
      project_id: "project-1",
      completed: false,
    })).toMatchObject({
      dueDateTime: { dateTime: "2026-09-01T14:30:00.000", timeZone: "UTC" },
      reminderDateTime: null,
      isReminderOn: false,
      status: "notStarted",
    });
  });

  it("maps Graph values back without trusting unsupported HTML", () => {
    expect(mapGraphTaskToTenderFlow({
      id: "ms-task-1",
      title: "Zavolat investorovi",
      body: { content: "Probrat termín", contentType: "text" },
      dueDateTime: { dateTime: "2026-09-02T08:00:00.000", timeZone: "UTC" },
      reminderDateTime: null,
      isReminderOn: false,
      importance: "low",
      status: "notStarted",
      completedDateTime: { dateTime: "2026-09-02T09:15:00.000", timeZone: "UTC" },
      lastModifiedDateTime: "2026-08-27T09:00:00Z",
      "@odata.etag": "W/\"etag-1\"",
    })).toEqual({
      externalId: "ms-task-1",
      externalEtag: "W/\"etag-1\"",
      externalUpdatedAt: "2026-08-27T09:00:00Z",
      title: "Zavolat investorovi",
      note: "Probrat termín",
      dueAt: "2026-09-02T08:00:00.000Z",
      reminderAt: null,
      priority: 4,
      completed: false,
      completedAt: "2026-09-02T09:15:00.000Z",
    });
  });

  it("keeps the newer local pending edit but applies a newer remote edit", () => {
    expect(shouldApplyRemoteTask({
      localSyncStatus: "pending",
      localUpdatedAt: "2026-08-27T10:00:00Z",
      remoteUpdatedAt: "2026-08-27T09:59:59Z",
    })).toBe(false);
    expect(shouldApplyRemoteTask({
      localSyncStatus: "pending",
      localUpdatedAt: "2026-08-27T10:00:00Z",
      remoteUpdatedAt: "2026-08-27T10:00:01Z",
    })).toBe(true);
    expect(shouldApplyRemoteTask({
      localSyncStatus: "synced",
      localUpdatedAt: "2026-08-27T10:00:00Z",
      remoteUpdatedAt: "2026-08-27T09:00:00Z",
    })).toBe(true);
  });

  it("follows an opaque Graph delta link only on the expected HTTPS origin and path", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [{ id: "task-1", title: "První" }],
        "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/todo/lists/list-1/tasks/delta?$skiptoken=next",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [{ id: "task-2", title: "Druhý" }],
        "@odata.deltaLink": "https://graph.microsoft.com/v1.0/me/todo/lists/list-1/tasks/delta?$deltatoken=done",
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(collectMicrosoftTodoDelta({
      accessToken: "secret-token",
      listId: "list-1",
    })).resolves.toEqual({
      items: [
        { id: "task-1", title: "První" },
        { id: "task-2", title: "Druhý" },
      ],
      deltaLink: "https://graph.microsoft.com/v1.0/me/todo/lists/list-1/tasks/delta?$deltatoken=done",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a forged Graph delta link before sending the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      value: [],
      "@odata.nextLink": "https://evil.example/steal",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(collectMicrosoftTodoDelta({
      accessToken: "secret-token",
      listId: "list-1",
    })).rejects.toThrow("Unsafe Microsoft To Do delta URL");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops cyclic Graph pagination", async () => {
    const nextLink = "https://graph.microsoft.com/v1.0/me/todo/lists/list-1/tasks/delta?$skiptoken=same";
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      value: [],
      "@odata.nextLink": nextLink,
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(collectMicrosoftTodoDelta({
      accessToken: "secret-token",
      listId: "list-1",
    })).rejects.toThrow("Microsoft To Do delta pagination cycle");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
