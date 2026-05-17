import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FILTER_STATE } from "@features/command-center/types";
import type { DerivedAction } from "@features/command-center/types";
import type { Project } from "@/types";
import type { Task } from "@features/tasks";

const actionQueueState = vi.hoisted(() => ({
  derived: [] as DerivedAction[],
  tasks: [] as Task[],
  projects: [] as Project[],
  toggleTask: vi.fn(),
}));

vi.mock("@features/command-center/hooks/useDerivedActions", () => ({
  useDerivedActions: () => actionQueueState.derived,
}));

vi.mock("@features/projects/model/useProjectPortfolioState", () => ({
  useProjectPortfolioState: () => ({
    projects: actionQueueState.projects,
  }),
}));

vi.mock("@features/tasks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@features/tasks")>();
  return {
    ...actual,
    useTasksQuery: () => ({
      data: actionQueueState.tasks,
      isLoading: false,
      isFetching: false,
    }),
    useToggleTaskMutation: () => ({
      mutate: actionQueueState.toggleTask,
      isPending: false,
    }),
    TaskFormModal: ({ isOpen }: { isOpen: boolean }) => (
      isOpen ? <div role="dialog">Detail úkolu</div> : null
    ),
  };
});

import { ActionQueueModule } from "@features/command-center/modules/action-queue/ActionQueueModule";

const renderActionQueue = () =>
  render(
    <ActionQueueModule
      settings={{}}
      onSettingsChange={vi.fn()}
      filterState={DEFAULT_FILTER_STATE}
      onFilterChange={vi.fn()}
    />,
  );

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  title: "Zkontrolovat rozpočet",
  note: "Dopočítat položky a termín dodání.",
  completed: false,
  sortOrder: 0,
  priority: 2,
  projectId: "project-1",
  dueAt: "2026-05-19T10:00:00.000Z",
  createdBy: "user-1",
  createdAt: "2026-05-18T08:00:00.000Z",
  updatedAt: "2026-05-18T08:00:00.000Z",
  ...overrides,
});

describe("ActionQueueModule", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T10:00:00.000Z"));
    actionQueueState.derived = [];
    actionQueueState.tasks = [];
    actionQueueState.projects = [];
    actionQueueState.toggleTask.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("nezobrazuje možnost ručního přidání úkolu", () => {
    renderActionQueue();

    expect(screen.queryByPlaceholderText("+ Přidat úkol…")).not.toBeInTheDocument();
    expect(screen.queryByText("+ Přidat úkol...")).not.toBeInTheDocument();
  });

  it("zobrazí osobní úkol v čistém zarovnaném řádku s prioritou, stavbou a termínem", () => {
    actionQueueState.projects = [
      {
        id: "project-1",
        name: "REKO Bazén Aš",
        location: "Aš",
        status: "realization",
      },
    ];
    actionQueueState.tasks = [makeTask()];

    const { container } = renderActionQueue();
    const row = container.querySelector('[data-help-id="cc-queue-item"][data-kind="task"]');

    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Zkontrolovat rozpočet")).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText("Dopočítat položky a termín dodání.")).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText("Úkol")).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText("P2")).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText("REKO Bazén Aš")).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText("zítra")).toBeInTheDocument();
  });

  it("ponechá označení úkolu jako hotového bez otevření detailu", () => {
    actionQueueState.tasks = [makeTask()];

    renderActionQueue();
    fireEvent.click(screen.getByRole("checkbox", { name: "Označit úkol jako hotový" }));

    expect(actionQueueState.toggleTask).toHaveBeenCalledWith({ id: "task-1", completed: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
