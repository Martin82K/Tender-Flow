import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickAdd } from "@features/tasks/ui/TasksPage";

const mutationState = vi.hoisted(() => ({
  createTask: vi.fn(),
  projects: [] as Array<{ id: string; name: string }>,
}));

vi.mock("@features/tasks/hooks/useTaskMutations", () => ({
  useCreateTaskMutation: () => ({
    mutateAsync: mutationState.createTask,
    isPending: false,
  }),
  useDeleteTaskMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useToggleTaskMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useUpdateTaskMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@features/projects/model/useProjectsState", () => ({
  useProjectsState: () => ({ projects: mutationState.projects }),
}));

describe("QuickAdd", () => {
  beforeEach(() => {
    mutationState.createTask.mockReset();
    mutationState.projects = [];
  });

  it("zobrazí srozumitelnou chybu, když databázi chybí reminder_at", async () => {
    mutationState.createTask.mockRejectedValue({
      code: "PGRST204",
      message: "Could not find the 'reminder_at' column of 'tasks' in the schema cache",
    });

    render(<QuickAdd currentView="inbox" todoProjects={[]} />);

    fireEvent.focus(screen.getByLabelText("Nový úkol"));
    fireEvent.change(screen.getByLabelText("Název úkolu"), {
      target: { value: "Úkol s upozorněním" },
    });
    fireEvent.change(screen.getByLabelText("Datum splnění"), {
      target: { value: "2026-05-18T17:00" },
    });
    fireEvent.change(screen.getByLabelText("Upozornění"), {
      target: { value: "2026-05-18T16:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Přidat úkol" }));

    expect(
      await screen.findByText(/Upozornění vyžaduje databázovou migraci reminder_at/i),
    ).toBeInTheDocument();
  });

  it("vykreslí inline selecty bez nativního vnitřního pozadí", () => {
    render(<QuickAdd currentView="inbox" todoProjects={[]} />);

    fireEvent.focus(screen.getByLabelText("Nový úkol"));

    expect(screen.getByLabelText("Priorita")).toHaveClass("tf-quick-add-select");
    expect(screen.getByLabelText("TODO projekt")).toHaveClass("tf-quick-add-select");
    expect(screen.getByLabelText("Kontext stavby")).toHaveClass("tf-quick-add-select");
  });

  it("drží výběr stavby v rychlém formuláři kompaktní i s dlouhým názvem", () => {
    mutationState.projects = [
      {
        id: "project-1",
        name: "Administrativní centrum s velmi dlouhým názvem stavby Praha-Smíchov etapa II",
      },
    ];

    render(<QuickAdd currentView="inbox" todoProjects={[]} />);

    fireEvent.focus(screen.getByLabelText("Nový úkol"));

    const projectSelect = screen.getByLabelText("Kontext stavby");
    expect(projectSelect).toHaveClass("w-[180px]", "truncate");
    expect(projectSelect.closest("label")).toHaveClass("sm:max-w-[240px]");
    expect(projectSelect.closest("label")).not.toHaveClass("flex-1");
  });
});
