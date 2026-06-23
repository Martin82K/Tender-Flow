import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TodoProjectSection } from "@features/tasks/ui/TasksPage";
import type { TodoProject } from "@features/tasks/types";

const mutationState = vi.hoisted(() => ({
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}));

vi.mock("@features/tasks/hooks/useTaskProjectMutations", () => ({
  useCreateTodoProjectMutation: () => ({
    mutateAsync: mutationState.createProject,
    isPending: false,
  }),
  useUpdateTodoProjectMutation: () => ({
    mutateAsync: mutationState.updateProject,
    isPending: false,
  }),
  useDeleteTodoProjectMutation: () => ({
    mutateAsync: mutationState.deleteProject,
    isPending: false,
  }),
}));

vi.mock("@shared/ui/ConfirmationModal", () => ({
  ConfirmationModal: ({
    isOpen,
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <p>{message}</p>
        <button type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

const project: TodoProject = {
  id: "todo-project-1",
  name: "Bazén",
  sortOrder: 0,
  createdBy: "user-1",
  createdAt: "2026-05-17T10:00:00Z",
  updatedAt: "2026-05-17T10:00:00Z",
};

const renderSection = () => {
  const onSelectProject = vi.fn();
  const onProjectDeleted = vi.fn();

  render(
    <TodoProjectSection
      projects={[project]}
      selectedTodoProjectId={project.id}
      taskTree={[]}
      onSelectProject={onSelectProject}
      onProjectDeleted={onProjectDeleted}
    />,
  );

  return { onSelectProject, onProjectDeleted };
};

describe("TodoProjectSection", () => {
  beforeEach(() => {
    mutationState.createProject.mockReset();
    mutationState.updateProject.mockReset();
    mutationState.deleteProject.mockReset();
    mutationState.createProject.mockResolvedValue(project);
    mutationState.updateProject.mockResolvedValue({ ...project, name: "Nový název" });
    mutationState.deleteProject.mockResolvedValue(undefined);
  });

  it("otevře na pravé tlačítko kontextové menu a umožní přejmenování TODO projektu", async () => {
    renderSection();

    expect(screen.getByText("Moje projekty")).toBeInTheDocument();

    fireEvent.contextMenu(screen.getByRole("button", { name: /Bazén/i }), {
      clientX: 80,
      clientY: 120,
    });
    expect(screen.getByRole("menu", { name: "Akce TODO projektu" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: /Upravit projekt/i }));
    const input = screen.getByLabelText("Název TODO projektu");
    fireEvent.change(input, { target: { value: "Nový název" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(mutationState.updateProject).toHaveBeenCalledWith({
        id: project.id,
        input: { name: "Nový název" },
      });
    });
  });

  it("označí vybraný TODO projekt jako aktuální filtr", () => {
    renderSection();

    const projectButton = screen.getByRole("button", { name: /Bazén/i });
    expect(projectButton).toHaveAttribute("data-active", "true");
    expect(projectButton).toHaveAttribute("aria-current", "page");
    expect(projectButton).toHaveClass("bg-orange-50");
    expect(projectButton).toHaveClass("border-orange-300");
    expect(projectButton).toHaveClass("text-orange-700");
  });

  it("umožní změnit barvu TODO projektu", async () => {
    renderSection();

    fireEvent.contextMenu(screen.getByRole("button", { name: /Bazén/i }), {
      clientX: 80,
      clientY: 120,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: /Upravit projekt/i }));
    fireEvent.click(screen.getByRole("button", { name: "Barva #3b82f6" }));
    fireEvent.submit(screen.getByLabelText("Název TODO projektu").closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(mutationState.updateProject).toHaveBeenCalledWith({
        id: project.id,
        input: { color: "#3b82f6" },
      });
    });
  });

  it("umožní změnit barvu přímo z kontextového menu projektu", async () => {
    renderSection();

    fireEvent.contextMenu(screen.getByRole("button", { name: /Bazén/i }), {
      clientX: 80,
      clientY: 120,
    });
    const colorGroup = screen.getByRole("group", { name: "Změnit barvu TODO projektu" });
    expect(colorGroup).toBeInTheDocument();
    expect(within(colorGroup).getAllByRole("button")).toHaveLength(19);
    expect(screen.getByRole("button", { name: "Změnit barvu projektu na #0ea5e9" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Změnit barvu projektu na #3b82f6" }));

    await waitFor(() => {
      expect(mutationState.updateProject).toHaveBeenCalledWith({
        id: project.id,
        input: { color: "#3b82f6" },
      });
    });
  });

  it("otevře potvrzení smazání a po potvrzení smaže TODO projekt", async () => {
    const { onProjectDeleted } = renderSection();

    fireEvent.contextMenu(screen.getByRole("button", { name: /Bazén/i }), {
      clientX: 80,
      clientY: 120,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: /Smazat projekt/i }));

    expect(screen.getByRole("dialog", { name: "Smazat TODO projekt?" })).toHaveTextContent(
      "Úkoly zůstanou zachované",
    );

    fireEvent.click(screen.getByRole("button", { name: "Smazat projekt" }));

    await waitFor(() => {
      expect(mutationState.deleteProject).toHaveBeenCalledWith(project.id);
      expect(onProjectDeleted).toHaveBeenCalledWith(project.id);
    });
  });
});
