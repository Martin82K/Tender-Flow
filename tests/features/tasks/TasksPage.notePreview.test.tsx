import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TasksPage, buildUpcomingAgendaGroups } from "@features/tasks/ui/TasksPage";
import type { Task, TodoProject } from "@features/tasks/types";

const taskState = vi.hoisted(() => ({
  tasks: [] as Task[],
  todoProjects: [] as TodoProject[],
  toggleTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock("@shared/ui/Header", () => ({
  Header: ({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      {children}
    </header>
  ),
}));

vi.mock("@features/help", () => ({
  HelpButton: () => null,
}));

vi.mock("@features/notifications/ui/NotificationBell", () => ({
  NotificationBell: () => null,
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

vi.mock("@features/projects/model/useProjectsState", () => ({
  useProjectsState: () => ({ projects: [] }),
}));

vi.mock("@features/tasks/hooks/useTasksQuery", () => ({
  useTasksQuery: () => ({
    data: taskState.tasks,
    isLoading: false,
    isFetching: false,
  }),
}));

vi.mock("@features/tasks/hooks/useTaskProjectsQuery", () => ({
  useTaskProjectsQuery: () => ({
    data: taskState.todoProjects,
    isLoading: false,
    isFetching: false,
  }),
}));

vi.mock("@features/tasks/hooks/useTaskMutations", () => ({
  useCreateTaskMutation: () => ({
    mutateAsync: taskState.createTask,
    isPending: false,
  }),
  useDeleteTaskMutation: () => ({
    mutateAsync: taskState.deleteTask,
    isPending: false,
  }),
  useToggleTaskMutation: () => ({
    mutate: taskState.toggleTask,
    isPending: false,
  }),
  useUpdateTaskMutation: () => ({
    mutateAsync: taskState.updateTask,
    isPending: false,
  }),
}));

vi.mock("@features/tasks/hooks/useTaskProjectMutations", () => ({
  useCreateTodoProjectMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateTodoProjectMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeleteTodoProjectMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  title: "Testovací úkol",
  note: "Koordinovat betonáž a připravit doplňující podklady.",
  sortOrder: 0,
  completed: false,
  createdBy: "user-1",
  createdAt: "2026-05-17T10:00:00Z",
  updatedAt: "2026-05-17T10:00:00Z",
  ...overrides,
});

const todayAt = (hour: number, minute = 0): string => {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
};

describe("TasksPage note preview", () => {
  beforeEach(() => {
    setViewportWidth(1024);
    taskState.tasks = [];
    taskState.todoProjects = [];
    taskState.toggleTask.mockReset();
    taskState.createTask.mockReset();
    taskState.updateTask.mockReset();
    taskState.deleteTask.mockReset();
  });

  it("zobrazí popis hlavního úkolu i podúkolu přímo v seznamu", () => {
    taskState.tasks = [
      makeTask({ id: "root", title: "Připravit betonáž" }),
      makeTask({
        id: "subtask",
        title: "Ověřit čerpadlo",
        note: "Domluvit dostupnost techniky na ráno.",
        parentTaskId: "root",
        sortOrder: 1,
      }),
    ];

    const { container } = render(<TasksPage />);
    const taskList = container.querySelector('[data-help-id="tasks-list"]');

    expect(taskList).not.toBeNull();
    expect(within(taskList as HTMLElement).getByText("Koordinovat betonáž a připravit doplňující podklady.")).toBeInTheDocument();
    expect(within(taskList as HTMLElement).getByText("Domluvit dostupnost techniky na ráno.")).toBeInTheDocument();
  });

  it("zobrazí fajfku jen u hotových položek", () => {
    taskState.tasks = [
      makeTask({ id: "root", title: "Připravit betonáž" }),
      makeTask({
        id: "open-subtask",
        title: "Ověřit čerpadlo",
        parentTaskId: "root",
        sortOrder: 1,
      }),
      makeTask({
        id: "done-subtask",
        title: "Vyžádat podklady",
        completed: true,
        completedAt: "2026-05-17T12:00:00Z",
        parentTaskId: "root",
        sortOrder: 2,
      }),
    ];

    const { container } = render(<TasksPage />);
    const taskList = container.querySelector('[data-help-id="tasks-list"]');

    expect(taskList).not.toBeNull();

    const rootCheckbox = within(taskList as HTMLElement).getByRole("checkbox", {
      name: "Označit úkol jako hotový",
    });
    const openSubtaskCheckbox = within(taskList as HTMLElement).getByRole("button", {
      name: "Označit podúkol jako hotový",
    });
    const doneSubtaskCheckbox = within(taskList as HTMLElement).getByRole("button", {
      name: "Znovu otevřít podúkol",
    });

    expect(rootCheckbox).not.toHaveTextContent("✓");
    expect(openSubtaskCheckbox).not.toHaveTextContent("✓");
    expect(doneSubtaskCheckbox).toHaveTextContent("✓");
    expect(screen.getByDisplayValue("Vyžádat podklady")).toBeInTheDocument();
  });

  it("umožní smazat úkol přes kontextové menu na pravé tlačítko", async () => {
    taskState.tasks = [
      makeTask({
        id: "delete-me",
        title: "Smazatelný úkol",
      }),
    ];
    taskState.deleteTask.mockResolvedValue(undefined);

    render(<TasksPage />);

    const deleteRow = screen.getByText("Smazatelný úkol").closest('[data-help-id="tasks-list-item"]');
    expect(deleteRow).not.toBeNull();

    fireEvent.contextMenu(deleteRow as HTMLElement, {
      clientX: 80,
      clientY: 120,
    });

    expect(screen.getByRole("menu", { name: "Akce úkolu" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Smazat úkol" }));

    expect(screen.getByRole("dialog", { name: "Smazat úkol?" })).toHaveTextContent(
      'Úkol "Smazatelný úkol" bude trvale odstraněn včetně podúkolů.',
    );
    fireEvent.click(screen.getByRole("button", { name: "Smazat úkol" }));

    await waitFor(() => {
      expect(taskState.deleteTask).toHaveBeenCalledWith("delete-me");
    });
  });

  it("umožní přidat podúkol přímo z řádku hlavního úkolu", async () => {
    taskState.todoProjects = [
      {
        id: "todo-loket",
        name: "LOKET",
        sortOrder: 0,
        createdBy: "user-1",
        createdAt: "2026-05-17T10:00:00Z",
        updatedAt: "2026-05-17T10:00:00Z",
      },
    ];
    taskState.tasks = [
      makeTask({
        id: "root",
        title: "Midas - CN svodidla",
        todoProjectId: "todo-loket",
        projectId: "project-loket",
      }),
      makeTask({
        id: "existing-subtask",
        title: "Prověřit termín",
        parentTaskId: "root",
        sortOrder: 0,
      }),
    ];
    taskState.createTask.mockResolvedValue(makeTask({ id: "new-subtask" }));

    render(<TasksPage />);

    fireEvent.click(screen.getByRole("button", { name: /LOKET/i }));
    fireEvent.click(screen.getByRole("button", { name: "Přidat podúkol k úkolu Midas - CN svodidla" }));

    const dialog = screen.getByRole("dialog", { name: "Přidat podúkol" });
    expect(dialog).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("textbox", { name: "Název podúkolu" }), {
      target: { value: "  Ověřit výkazy u dodavatele  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Přidat podúkol" }));

    await waitFor(() => {
      expect(taskState.createTask).toHaveBeenCalledWith({
        title: "Ověřit výkazy u dodavatele",
        parentTaskId: "root",
        todoProjectId: "todo-loket",
        projectId: "project-loket",
        sortOrder: 1,
      });
    });
    expect(screen.queryByRole("dialog", { name: "Přidat podúkol" })).not.toBeInTheDocument();
  });

  it("označí aktuální systémový pohled a vyplní jeho ikonu", () => {
    const { container } = render(<TasksPage />);
    const menu = container.querySelector('[data-help-id="tasks-menu"]');

    expect(menu).not.toBeNull();

    const inboxButton = within(menu as HTMLElement).getByRole("button", { name: /Inbox/i });
    expect(inboxButton).toHaveAttribute("data-active", "true");
    expect(inboxButton).toHaveAttribute("aria-current", "page");
    expect(inboxButton).toHaveClass("bg-orange-50");
    expect(inboxButton).toHaveClass("text-orange-700");
    expect(inboxButton.querySelector('[data-help-id="tasks-menu-icon"]')).toHaveClass("fill");

    fireEvent.click(within(menu as HTMLElement).getByRole("button", { name: /Dnes/i }));

    const todayButton = within(menu as HTMLElement).getByRole("button", { name: /Dnes/i });
    expect(todayButton).toHaveAttribute("data-active", "true");
    expect(todayButton).toHaveAttribute("aria-current", "page");
    expect(todayButton).toHaveClass("bg-orange-50");
    expect(todayButton).toHaveClass("text-orange-700");
    expect(todayButton.querySelector('[data-help-id="tasks-menu-icon"]')).toHaveClass("fill");
    expect(inboxButton).toHaveAttribute("data-active", "false");
    expect(inboxButton.querySelector('[data-help-id="tasks-menu-icon"]')).not.toHaveClass("fill");
  });

  it("zobrazí u archivu popisek retence 30 dnů", () => {
    const { container } = render(<TasksPage />);
    const menu = container.querySelector('[data-help-id="tasks-menu"]');

    expect(menu).not.toBeNull();
    expect(within(menu as HTMLElement).getByRole("button", { name: /Archiv/i })).toHaveTextContent(
      "Smaže se po 30 dnech",
    );
  });

  it("umožní přetažením změnit pořadí hlavních úkolů v seznamu", async () => {
    taskState.tasks = [
      makeTask({
        id: "first",
        title: "Bazén Aš - tepelná izolace",
        priority: 2,
        sortOrder: 0,
      }),
      makeTask({
        id: "second",
        title: "Rozeslat poptávky Fibichova",
        priority: 1,
        sortOrder: 1,
      }),
      makeTask({
        id: "third",
        title: "Zkoušky betonu",
        priority: 2,
        sortOrder: 2,
      }),
    ];
    taskState.updateTask.mockResolvedValue(makeTask());

    const { container } = render(<TasksPage />);
    fireEvent.click(screen.getByRole("button", { name: /Důležité/i }));

    const dragHandle = screen.getByRole("button", { name: "Přesunout úkol Zkoušky betonu" });
    const targetRow = screen.getByText("Bazén Aš - tepelná izolace").closest('[data-help-id="tasks-list-item"]');
    const dragData: Record<string, string> = {};
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn((type: string, value: string) => {
        dragData[type] = value;
      }),
      getData: vi.fn((type: string) => dragData[type] ?? ""),
    };

    expect(targetRow).not.toBeNull();
    expect(targetRow).not.toHaveAttribute("title");
    expect(dragHandle).toHaveClass("size-4");
    expect(dragHandle).not.toHaveAttribute("title");

    fireEvent.dragStart(dragHandle, { dataTransfer });
    fireEvent.dragOver(targetRow as HTMLElement, { dataTransfer });
    expect(targetRow).toHaveAttribute("data-drop-target", "true");
    fireEvent.drop(targetRow as HTMLElement, { dataTransfer });

    await waitFor(() => {
      expect(taskState.updateTask).toHaveBeenCalledWith({ id: "third", input: { sortOrder: 0 } });
      expect(taskState.updateTask).toHaveBeenCalledWith({ id: "first", input: { sortOrder: 1 } });
      expect(taskState.updateTask).toHaveBeenCalledWith({ id: "second", input: { sortOrder: 2 } });
    });

    const rows = Array.from(container.querySelectorAll('[data-help-id="tasks-list-item"]'));
    expect(rows).toHaveLength(3);
  });

  it("seskupí nadcházející úkoly do agendy včetně zpožděných podúkolů", () => {
    const groups = buildUpcomingAgendaGroups(
      [
        {
          task: makeTask({
            id: "root",
            title: "Opěrné stěny Bečov",
            dueAt: "2026-05-18T09:00:00Z",
          }),
          subtasks: [
            makeTask({
              id: "late-subtask",
              title: "Doplnit tabulku materiálů",
              parentTaskId: "root",
              dueAt: "2026-05-16T09:00:00Z",
            }),
          ],
        },
        {
          task: makeTask({
            id: "today",
            title: "Oli u stvořitele",
            dueAt: "2026-05-17T12:00:00Z",
          }),
          subtasks: [],
        },
      ],
      new Date("2026-05-17T10:00:00Z"),
    );

    expect(groups.map((group) => group.label)).toEqual(["Zpožděné", "Dnes", "Zítra"]);
    expect(groups[0].items.map((item) => item.task.id)).toEqual(["late-subtask"]);
    expect(groups[2].items.map((item) => item.task.id)).toEqual(["root"]);
  });

  it("zobrazí prázdný detail jako panel v designu aplikace", () => {
    const { container } = render(<TasksPage />);

    const layout = container.querySelector("main");
    const detail = container.querySelector('[data-help-id="tasks-detail"]');
    const emptyState = container.querySelector('[data-help-id="tasks-detail-empty"]');

    expect(layout).toHaveClass("lg:grid-cols-[260px_minmax(0,1fr)_380px]");
    expect(detail).not.toBeNull();
    expect(detail).toHaveClass("rounded-xl");
    expect(detail).toHaveClass("border-orange-200/70");
    expect(detail).toHaveClass("p-3");
    expect(emptyState).not.toBeNull();
    expect(within(emptyState as HTMLElement).getByText("Žádný úkol není vybraný")).toBeInTheDocument();
    expect(within(emptyState as HTMLElement).getByText("Vyberte úkol ze seznamu nebo vytvořte nový.")).toBeInTheDocument();
  });

  it("na mobilu drží menu kompaktní a detail úkolu otevírá jako spodní sheet", () => {
    setViewportWidth(390);
    taskState.tasks = [
      makeTask({
        id: "mobile-upcoming",
        title: "Boučí",
        note: "úkol 1",
        dueAt: todayAt(17),
      }),
    ];

    const { container } = render(<TasksPage />);
    const menu = container.querySelector('[data-help-id="tasks-menu"]');
    const list = container.querySelector('[data-help-id="tasks-list"]');
    const menuToggle = container.querySelector('[data-help-id="tasks-mobile-menu-toggle"]');

    expect(menu).not.toBeNull();
    expect(list).not.toBeNull();
    expect(menuToggle).not.toBeNull();
    expect(screen.queryByDisplayValue("Boučí")).not.toBeInTheDocument();
    expect(menu).toHaveAttribute("data-mobile-open", "false");

    fireEvent.click(menuToggle as HTMLElement);
    fireEvent.click(within(menu as HTMLElement).getByRole("button", { name: /Nadcházející/i }));

    expect(menu).toHaveAttribute("data-mobile-open", "false");
    expect(list).toHaveAttribute("data-mobile-hidden", "false");
    fireEvent.click(screen.getByRole("button", { name: /Boučí/i }));

    expect(list).toHaveAttribute("data-mobile-hidden", "false");
    expect(list).toHaveAttribute("data-mobile-detail-open", "true");
    expect(screen.getByRole("dialog", { name: "Detail úkolu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zavřít detail" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Boučí")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Zavřít detail" }));

    expect(list).toHaveAttribute("data-mobile-hidden", "false");
    expect(list).toHaveAttribute("data-mobile-detail-open", "false");
    expect(screen.queryByDisplayValue("Boučí")).not.toBeInTheDocument();
  });

  it("řadí úkoly ve stejném dni kalendáře podle času", () => {
    taskState.tasks = [
      makeTask({
        id: "late",
        title: "Pozdější kontrola",
        dueAt: todayAt(17),
        createdAt: "2026-05-17T11:00:00Z",
      }),
      makeTask({
        id: "early",
        title: "Ranní kontrola",
        dueAt: todayAt(9),
        createdAt: "2026-05-17T10:00:00Z",
      }),
    ];

    const { container } = render(<TasksPage />);
    fireEvent.click(screen.getByRole("button", { name: /Kalendář/i }));

    const calendarTasks = Array.from(container.querySelectorAll('[data-help-id="todo-calendar-task"]'));

    expect(calendarTasks).toHaveLength(2);
    expect(calendarTasks[0]).toHaveTextContent("Ranní kontrola");
    expect(calendarTasks[0]).toHaveTextContent("09:00");
    expect(calendarTasks[1]).toHaveTextContent("Pozdější kontrola");
    expect(calendarTasks[1]).toHaveTextContent("17:00");
  });

  it("v úzké kalendářové kartě oddělí projektový badge od zalamovaného názvu úkolu", () => {
    taskState.todoProjects = [
      {
        id: "project-1",
        name: "Boučí",
        color: "#22c55e",
        sortOrder: 0,
        createdAt: "2026-05-17T10:00:00Z",
        updatedAt: "2026-05-17T10:00:00Z",
      },
    ];
    taskState.tasks = [
      makeTask({
        id: "narrow-card",
        title: "Zkoušky betonu před novou betonáží",
        dueAt: todayAt(17),
        todoProjectId: "project-1",
      }),
    ];

    const { container } = render(<TasksPage />);
    fireEvent.click(screen.getByRole("button", { name: /Kalendář/i }));

    const card = container.querySelector('[data-help-id="todo-calendar-task"]');
    const heading = card?.querySelector('[data-help-id="todo-calendar-task-heading"]');
    const chip = card?.querySelector('[data-help-id="todo-calendar-task-chip"]');
    const title = card?.querySelector('[data-help-id="todo-calendar-task-title"]');

    expect(card).not.toBeNull();
    expect(heading).toHaveClass("block");
    expect(chip).toHaveTextContent("# Boučí");
    expect(title).toHaveTextContent("Zkoušky betonu před novou betonáží");
    expect(title).toHaveClass("whitespace-normal");
    expect(title).toHaveClass("break-words");
    expect(title).not.toHaveClass("truncate");
    expect(Boolean(chip && title && (chip.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  });
});
