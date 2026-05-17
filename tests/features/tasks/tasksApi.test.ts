import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  insertPayload: undefined as Record<string, unknown> | undefined,
  updatePayload: undefined as Record<string, unknown> | undefined,
}));

const makeRow = (overrides: Record<string, unknown> = {}) => ({
  id: "task-1",
  title: "Úkol",
  note: null,
  due_at: null,
  priority: null,
  project_id: null,
  related_entity_type: null,
  related_entity_id: null,
  completed: false,
  completed_at: null,
  created_by: "user-1",
  created_at: "2026-05-17T10:00:00Z",
  updated_at: "2026-05-17T10:00:00Z",
  external_id: null,
  external_provider: null,
  external_url: null,
  last_synced_at: null,
  sync_status: null,
  sync_error: null,
  ...overrides,
});

vi.mock("@infra/db/dbAdapter", () => ({
  dbAdapter: {
    from: () => ({
      insert: (payload: Record<string, unknown>) => {
        dbState.insertPayload = payload;
        return {
          select: () => ({
            single: async () => ({ data: makeRow(payload), error: null }),
          }),
        };
      },
      update: (payload: Record<string, unknown>) => {
        dbState.updatePayload = payload;
        return {
          eq: () => ({
            select: () => ({
              single: async () => ({ data: makeRow(payload), error: null }),
            }),
          }),
        };
      },
    }),
  },
}));

import { createTask, updateTask } from "@features/tasks/api/tasksApi";

describe("tasksApi", () => {
  beforeEach(() => {
    dbState.insertPayload = undefined;
    dbState.updatePayload = undefined;
  });

  it("při vytvoření bez upozornění neposílá reminder_at do payloadu", async () => {
    await createTask("user-1", { title: "Nový úkol" });

    expect(dbState.insertPayload).toMatchObject({
      title: "Nový úkol",
      note: null,
      due_at: null,
    });
    expect(dbState.insertPayload).not.toHaveProperty("reminder_at");
  });

  it("při update bez změny upozornění neposílá reminder_at do payloadu", async () => {
    await updateTask("task-1", {
      title: "Upravený úkol",
      note: "Poznámka",
      reminderAt: undefined,
    });

    expect(dbState.updatePayload).toEqual({
      title: "Upravený úkol",
      note: "Poznámka",
    });
  });
});
