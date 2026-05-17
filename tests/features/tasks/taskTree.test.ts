import { describe, expect, it } from "vitest";
import {
  buildTaskTree,
  filterTaskTreeByTodoProject,
  findTaskSelection,
  getSubtaskProgress,
  getTodoProjectRootCount,
  matchesTaskView,
} from "@features/tasks/model/taskTree";
import type { Task } from "@features/tasks/types";

const NOW = new Date("2026-05-17T10:00:00Z");

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  title: "Úkol",
  sortOrder: 0,
  completed: false,
  createdBy: "user-1",
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  ...overrides,
});

describe("taskTree", () => {
  it("seskupí root úkoly a podúkoly podle parentTaskId", () => {
    const tree = buildTaskTree([
      makeTask({ id: "sub-2", title: "Druhý", parentTaskId: "root", sortOrder: 2 }),
      makeTask({ id: "root", title: "Root" }),
      makeTask({ id: "sub-1", title: "První", parentTaskId: "root", sortOrder: 1 }),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].task.id).toBe("root");
    expect(tree[0].subtasks.map((task) => task.id)).toEqual(["sub-1", "sub-2"]);
  });

  it("počítá progress podúkolů", () => {
    expect(
      getSubtaskProgress([
        makeTask({ id: "a", completed: true }),
        makeTask({ id: "b", completed: false }),
      ]),
    ).toEqual({ done: 1, total: 2 });
  });

  it("najde výběr root úkolu i konkrétního podúkolu", () => {
    const tree = buildTaskTree([
      makeTask({ id: "root", title: "Root" }),
      makeTask({ id: "sub", title: "Podúkol", parentTaskId: "root" }),
    ]);

    expect(findTaskSelection(tree, "root")).toMatchObject({
      task: { id: "root" },
      isSubtask: false,
    });
    expect(findTaskSelection(tree, "sub")).toMatchObject({
      item: { task: { id: "root" } },
      task: { id: "sub" },
      isSubtask: true,
    });
    expect(findTaskSelection(tree, "missing")).toBeUndefined();
  });

  it("filtruje a počítá osobní TODO projekty podle root úkolů", () => {
    const tree = buildTaskTree([
      makeTask({ id: "p1-root", todoProjectId: "todo-project-1" }),
      makeTask({ id: "p1-sub", parentTaskId: "p1-root", todoProjectId: "todo-project-1" }),
      makeTask({ id: "p2-root", todoProjectId: "todo-project-2" }),
      makeTask({ id: "p1-done", todoProjectId: "todo-project-1", completed: true, completedAt: NOW.toISOString() }),
      makeTask({ id: "p1-archived", todoProjectId: "todo-project-1", archivedAt: NOW.toISOString() }),
    ]);

    expect(filterTaskTreeByTodoProject(tree, "todo-project-1").map((item) => item.task.id)).toEqual([
      "p1-root",
      "p1-done",
      "p1-archived",
    ]);
    expect(getTodoProjectRootCount(tree, "todo-project-1")).toBe(1);
  });

  it("filtruje inbox, dnes, nadcházející a důležité pohledy", () => {
    expect(matchesTaskView(makeTask({ dueAt: "2026-05-17T14:00:00Z" }), "calendar", NOW)).toBe(true);
    expect(matchesTaskView(makeTask(), "inbox", NOW)).toBe(true);
    expect(matchesTaskView(makeTask({ dueAt: "2026-05-17T14:00:00Z" }), "today", NOW)).toBe(true);
    expect(matchesTaskView(makeTask({ dueAt: "2026-05-18T14:00:00Z" }), "upcoming", NOW)).toBe(true);
    expect(matchesTaskView(makeTask({ priority: 2 }), "important", NOW)).toBe(true);
    expect(matchesTaskView(makeTask({ completed: true }), "completed", NOW)).toBe(true);
    expect(matchesTaskView(makeTask({ todoProjectId: "todo-project-1" }), "inbox", NOW)).toBe(false);
  });

  it("oddělí archivované úkoly od aktivních a hotových pohledů", () => {
    const archivedTask = makeTask({
      completed: true,
      completedAt: "2026-05-10T10:00:00Z",
      archivedAt: "2026-05-16T10:00:00Z",
    });

    expect(matchesTaskView(archivedTask, "archive", NOW)).toBe(true);
    expect(matchesTaskView(archivedTask, "completed", NOW)).toBe(false);
    expect(matchesTaskView(archivedTask, "inbox", NOW)).toBe(false);
  });
});
