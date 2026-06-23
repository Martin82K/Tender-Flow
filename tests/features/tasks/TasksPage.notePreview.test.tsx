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

const dateKey = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const getNeighborDayInCurrentWeek = (sourceIso: string): Date => {
  const targetDay = new Date(sourceIso);
  targetDay.setDate(targetDay.getDate() + (targetDay.getDay() === 0 ? -1 : 1));
  return targetDay;
};

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
};

const selectSystemView = (container: HTMLElement, viewName: RegExp) => {
  const menu = container.querySelector('[data-help-id="tasks-menu"]');
  expect(menu).not.toBeNull();
  fireEvent.click(within(menu as HTMLElement).getByRole("button", { name: viewName }));
};

const selectCalendarMode = (container: HTMLElement, modeName: string) => {
  const calendar = container.querySelector('[data-help-id="tasks-calendar"]');
  expect(calendar).not.toBeNull();
  fireEvent.click(within(calendar as HTMLElement).getByRole("button", { name: modeName }));
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
    selectSystemView(container, /Inbox/i);
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
    selectSystemView(container, /Inbox/i);
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
  });

  it("umožní smazat úkol přes kontextové menu na pravé tlačítko", async () => {
    taskState.tasks = [
      makeTask({
        id: "delete-me",
        title: "Smazatelný úkol",
      }),
    ];
    taskState.deleteTask.mockResolvedValue(undefined);

    const { container } = render(<TasksPage />);
    selectSystemView(container, /Inbox/i);

    const deleteCard = screen.getByText("Smazatelný úkol").closest('[data-help-id="tasks-list-item"]');
    const deleteRow = screen.getByText("Smazatelný úkol").closest('[data-help-id="tasks-root-row"]');
    expect(deleteCard).not.toBeNull();
    expect(deleteRow).not.toBeNull();

    fireEvent.contextMenu(deleteCard as HTMLElement, {
      clientX: 20,
      clientY: 40,
    });
    expect(screen.queryByRole("menu", { name: "Akce úkolu" })).not.toBeInTheDocument();

    fireEvent.contextMenu(deleteRow as HTMLElement, {
      clientX: 80,
      clientY: 120,
    });

    const menu = screen.getByRole("menu", { name: "Akce úkolu" });
    expect(menu).toBeInTheDocument();
    expect(menu).toHaveStyle({ left: "80px", top: "120px" });
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

    const { container } = render(<TasksPage />);
    selectSystemView(container, /Inbox/i);

    fireEvent.click(screen.getByRole("button", { name: /LOKET/i }));
    const addSubtaskButton = screen.getByRole("button", { name: "Přidat podúkol k úkolu Midas - CN svodidla" });
    const rowActions = addSubtaskButton.closest('[data-help-id="tasks-list-item-actions"]');
    expect(rowActions).not.toBeNull();
    expect(rowActions).toHaveClass("gap-2.5");
    expect(within(rowActions as HTMLElement).getByRole("button", { name: "Sbalit podúkoly" })).toBeInTheDocument();

    fireEvent.click(addSubtaskButton);

    const dialog = screen.getByRole("dialog", { name: "Přidat podúkol" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveClass("bg-slate-950/20");
    expect(dialog).not.toHaveClass("backdrop-blur-sm");
    expect(dialog.querySelector(".tf-modal-panel")).not.toBeNull();
    expect(within(dialog).getAllByRole("button", { name: "Zavřít přidání podúkolu" })).toHaveLength(1);
    expect(within(dialog).getByRole("textbox", { name: "Popis podúkolu" })).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: "Priorita podúkolu" })).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: "Kontext stavby podúkolu" })).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("textbox", { name: "Název podúkolu" }), {
      target: { value: "  Ověřit výkazy u dodavatele  " },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Popis podúkolu" }), {
      target: { value: "  Poslat dotaz na skladbu výkazu.  " },
    });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Priorita podúkolu" }), {
      target: { value: "2" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Přidat podúkol" }));

    await waitFor(() => {
      expect(taskState.createTask).toHaveBeenCalledWith({
        title: "Ověřit výkazy u dodavatele",
        note: "Poslat dotaz na skladbu výkazu.",
        priority: 2,
        parentTaskId: "root",
        todoProjectId: "todo-loket",
        projectId: "project-loket",
        sortOrder: 1,
      });
    });
    expect(screen.queryByRole("dialog", { name: "Přidat podúkol" })).not.toBeInTheDocument();
  });

  it("otevře přidání podúkolu z detailu jako modal místo inline formuláře", async () => {
    taskState.tasks = [
      makeTask({
        id: "root",
        title: "Bazén Aš - tepelná izolace",
      }),
    ];
    taskState.createTask.mockResolvedValue(makeTask({ id: "new-subtask" }));

    const { container } = render(<TasksPage />);
    selectSystemView(container, /Inbox/i);

    expect(screen.queryByRole("textbox", { name: "Nový podúkol" })).not.toBeInTheDocument();

    const rootRow = screen.getByText("Bazén Aš - tepelná izolace").closest('[data-help-id="tasks-root-row"]');
    expect(rootRow).not.toBeNull();
    fireEvent.doubleClick(rootRow as HTMLElement);

    fireEvent.click(screen.getByRole("button", { name: "Přidat podúkol" }));

    const dialog = screen.getByRole("dialog", { name: "Přidat podúkol" });
    expect(dialog).toHaveTextContent("Pod úkol: Bazén Aš - tepelná izolace");

    fireEvent.change(within(dialog).getByRole("textbox", { name: "Název podúkolu" }), {
      target: { value: "  Doptat výkaz izolací  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Přidat podúkol" }));

    await waitFor(() => {
      expect(taskState.createTask).toHaveBeenCalledWith({
        title: "Doptat výkaz izolací",
        parentTaskId: "root",
        todoProjectId: undefined,
        projectId: undefined,
        sortOrder: 0,
      });
    });
    expect(screen.queryByRole("dialog", { name: "Přidat podúkol" })).not.toBeInTheDocument();
  });

  it("otevře detail podúkolu dvojklikem na řádek podúkolu", () => {
    taskState.tasks = [
      makeTask({ id: "root", title: "Poptávky" }),
      makeTask({
        id: "subtask",
        title: "Betony",
        note: "Pravděpodobně dodávka bude Liapor.",
        parentTaskId: "root",
        sortOrder: 1,
      }),
    ];

    const { container } = render(<TasksPage />);
    selectSystemView(container, /Inbox/i);

    const subtaskRow = screen.getByText("Betony").closest('[data-help-id="tasks-subtask-row"]');
    expect(subtaskRow).not.toBeNull();

    fireEvent.doubleClick(subtaskRow as HTMLElement);

    expect(screen.getByText("Detail podúkolu")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Pravděpodobně dodávka bude Liapor.")).toBeInTheDocument();
  });

  it("otevře detail podúkolu přes kontextové menu", () => {
    taskState.tasks = [
      makeTask({ id: "root", title: "Poptávky" }),
      makeTask({
        id: "subtask",
        title: "Betony",
        note: "Nacenit materiál.",
        parentTaskId: "root",
        sortOrder: 1,
      }),
    ];

    const { container } = render(<TasksPage />);
    selectSystemView(container, /Inbox/i);

    const subtaskRow = screen.getByText("Betony").closest('[data-help-id="tasks-subtask-row"]');
    expect(subtaskRow).not.toBeNull();

    fireEvent.contextMenu(subtaskRow as HTMLElement, {
      clientX: 90,
      clientY: 140,
    });
    const menu = screen.getByRole("menu", { name: "Akce podúkolu" });
    expect(menu).toHaveStyle({ left: "90px", top: "140px" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Otevřít detail podúkolu" }));

    expect(screen.getByText("Detail podúkolu")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Nacenit materiál.")).toBeInTheDocument();
  });

  it("zavře detail klávesou Escape bez neuložených změn", () => {
    taskState.tasks = [
      makeTask({ id: "root", title: "Poptávky" }),
      makeTask({
        id: "subtask",
        title: "Betony",
        note: "Bez změn.",
        parentTaskId: "root",
        sortOrder: 1,
      }),
    ];

    const { container } = render(<TasksPage />);
    selectSystemView(container, /Inbox/i);

    const subtaskRow = screen.getByText("Betony").closest('[data-help-id="tasks-subtask-row"]');
    expect(subtaskRow).not.toBeNull();

    fireEvent.doubleClick(subtaskRow as HTMLElement);
    expect(screen.getByText("Detail podúkolu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByText("Detail podúkolu")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Detail podúkolu" })).not.toBeInTheDocument();
  });

  it("při zavření detailu s neuloženými změnami nabídne uložit nebo zahodit změny", async () => {
    taskState.tasks = [
      makeTask({ id: "root", title: "Poptávky" }),
      makeTask({
        id: "subtask",
        title: "Betony",
        note: "Původní poznámka.",
        parentTaskId: "root",
        sortOrder: 1,
      }),
    ];
    taskState.updateTask.mockResolvedValue(makeTask({ id: "subtask", title: "Betony upraveno" }));

    const { container } = render(<TasksPage />);
    selectSystemView(container, /Inbox/i);

    const subtaskRow = screen.getByText("Betony").closest('[data-help-id="tasks-subtask-row"]');
    expect(subtaskRow).not.toBeNull();

    fireEvent.doubleClick(subtaskRow as HTMLElement);
    fireEvent.change(screen.getByLabelText("Název"), {
      target: { value: "Betony upraveno" },
    });
    fireEvent.keyDown(document, { key: "Escape" });

    const unsavedDialog = screen.getByRole("dialog", { name: "Neuložené změny" });
    expect(unsavedDialog).toHaveTextContent("Detail obsahuje změny");
    expect(within(unsavedDialog).getByRole("button", { name: "Zahodit změny" })).toBeInTheDocument();
    fireEvent.click(within(unsavedDialog).getByRole("button", { name: "Uložit změny" }));

    await waitFor(() => {
      expect(taskState.updateTask).toHaveBeenCalledWith({
        id: "subtask",
        input: expect.objectContaining({ title: "Betony upraveno" }),
      });
    });
    expect(screen.queryByText("Detail podúkolu")).not.toBeInTheDocument();
  });

  it("otevře TODO standardně v kalendáři s jednodenním pohledem", () => {
    const { container } = render(<TasksPage />);
    const menu = container.querySelector('[data-help-id="tasks-menu"]');
    const calendar = container.querySelector('[data-help-id="tasks-calendar"]');

    expect(menu).not.toBeNull();
    expect(calendar).not.toBeNull();

    const calendarButton = within(menu as HTMLElement).getByRole("button", { name: /Kalendář/i });
    expect(calendarButton).toHaveAttribute("data-active", "true");
    expect(calendarButton).toHaveAttribute("aria-current", "page");
    expect(calendarButton).toHaveClass("bg-orange-50");
    expect(calendarButton).toHaveClass("text-orange-700");
    expect(calendarButton.querySelector('[data-help-id="tasks-menu-icon"]')).toHaveClass("fill");

    const dayModeButton = within(calendar as HTMLElement).getByRole("button", { name: "Den" });
    expect(dayModeButton).toHaveAttribute("data-active", "true");

    fireEvent.click(within(menu as HTMLElement).getByRole("button", { name: /Dnes/i }));

    const todayButton = within(menu as HTMLElement).getByRole("button", { name: /Dnes/i });
    expect(todayButton).toHaveAttribute("data-active", "true");
    expect(todayButton).toHaveAttribute("aria-current", "page");
    expect(todayButton).toHaveClass("bg-orange-50");
    expect(todayButton).toHaveClass("text-orange-700");
    expect(todayButton.querySelector('[data-help-id="tasks-menu-icon"]')).toHaveClass("fill");
    expect(calendarButton).toHaveAttribute("data-active", "false");
    expect(calendarButton.querySelector('[data-help-id="tasks-menu-icon"]')).not.toHaveClass("fill");
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

  it("nezobrazuje detail jako trvalý panel, dokud uživatel nezačne editovat", () => {
    const { container } = render(<TasksPage />);

    const layout = container.querySelector("main");
    const detail = container.querySelector('[data-help-id="tasks-detail"]');

    expect(layout).toHaveClass("lg:grid-cols-[260px_minmax(0,1fr)]");
    expect(detail).toBeNull();
    expect(screen.queryByText("Žádný úkol není vybraný")).not.toBeInTheDocument();
  });

  it("na mobilu drží menu kompaktní a detail úkolu otevírá přes celé okno", () => {
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
    expect(menuToggle).toHaveClass("self-start");
    expect(menu).toHaveClass("self-start");
    expect(menu).toHaveClass("lg:self-stretch");
    expect(screen.queryByDisplayValue("Boučí")).not.toBeInTheDocument();
    expect(menu).toHaveAttribute("data-mobile-open", "false");

    fireEvent.click(menuToggle as HTMLElement);
    fireEvent.click(within(menu as HTMLElement).getByRole("button", { name: /Nadcházející/i }));

    expect(menu).toHaveAttribute("data-mobile-open", "false");
    expect(list).toHaveAttribute("data-mobile-hidden", "false");
    const mobileTaskButton = screen.getByText("Boučí").closest("button");
    expect(mobileTaskButton).not.toBeNull();
    fireEvent.click(mobileTaskButton as HTMLElement);

    expect(list).toHaveAttribute("data-mobile-hidden", "false");
    expect(list).toHaveAttribute("data-mobile-detail-open", "true");
    const mobileDialog = screen.getByRole("dialog", { name: "Detail úkolu" });
    const mobileDetail = container.querySelector('[data-help-id="tasks-detail"][data-mobile-sheet="true"]');
    expect(mobileDialog).toBeInTheDocument();
    expect(mobileDialog).toHaveClass("fixed");
    expect(mobileDialog).toHaveClass("inset-0");
    expect(mobileDialog).not.toHaveClass("items-end");
    expect(mobileDialog).not.toHaveClass("pt-10");
    expect(mobileDetail).not.toBeNull();
    expect(mobileDetail).toHaveClass("h-[100dvh]");
    expect(mobileDetail).toHaveClass("rounded-none");
    expect(mobileDetail).toHaveClass("border-0");
    expect(mobileDetail).not.toHaveClass("rounded-t-2xl");
    expect(mobileDetail).not.toHaveClass("max-h-[86dvh]");
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

    const calendarTasks = Array.from(container.querySelectorAll('[data-help-id="todo-calendar-task"]'));

    expect(calendarTasks).toHaveLength(2);
    expect(calendarTasks[0]).toHaveTextContent("Ranní kontrola");
    expect(calendarTasks[0]).toHaveTextContent("09:00");
    expect(calendarTasks[1]).toHaveTextContent("Pozdější kontrola");
    expect(calendarTasks[1]).toHaveTextContent("17:00");
  });

  it("umožní označit kalendářovou kartu jako hotovou samostatným čtverečkem", () => {
    taskState.tasks = [
      makeTask({
        id: "calendar-complete",
        title: "Klášterec nad Ohří",
        dueAt: todayAt(17),
      }),
    ];

    const { container } = render(<TasksPage />);
    const card = container.querySelector('[data-help-id="todo-calendar-task"]');

    expect(card).not.toBeNull();
    fireEvent.click(
      within(card as HTMLElement).getByRole("checkbox", {
        name: "Označit úkol Klášterec nad Ohří jako hotový",
      }),
    );

    expect(taskState.toggleTask).toHaveBeenCalledWith({ id: "calendar-complete", completed: true });
    expect(screen.queryByRole("dialog", { name: "Detail úkolu" })).not.toBeInTheDocument();
  });

  it("otevře editaci kalendářové karty dvojklikem jako modal bez tlačítka Hotovo", () => {
    taskState.tasks = [
      makeTask({
        id: "calendar-edit",
        title: "Klášterec nad Ohří",
        note: "ocenit VV pro Klášterec na základě příslibu.",
        dueAt: todayAt(17),
      }),
    ];

    const { container } = render(<TasksPage />);
    const card = container.querySelector('[data-help-id="todo-calendar-task"]');

    expect(card).not.toBeNull();
    fireEvent.doubleClick(
      within(card as HTMLElement).getByRole("button", {
        name: /Klášterec nad Ohří/i,
      }),
    );

    const dialog = screen.getByRole("dialog", { name: "Detail úkolu" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("Klášterec nad Ohří")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Hotovo" })).not.toBeInTheDocument();
  });

  it("v agendě nabídne rychlé přidání podúkolu přímo z řádku", () => {
    taskState.tasks = [
      makeTask({
        id: "agenda-root",
        title: "Generální úklid stavby",
        note: "Doposlat zbývající poptávky",
        dueAt: todayAt(17),
      }),
    ];

    const { container } = render(<TasksPage />);
    selectSystemView(container, /Nadcházející/i);

    fireEvent.click(screen.getByRole("button", { name: "Přidat podúkol k úkolu Generální úklid stavby" }));

    const dialog = screen.getByRole("dialog", { name: "Přidat podúkol" });
    expect(dialog).toHaveTextContent("Pod úkol: Generální úklid stavby");
  });

  it("přesune kalendářovou aktivitu přetažením na jiný den a zachová čas", async () => {
    const sourceDueAt = todayAt(9, 30);
    const targetDayDate = getNeighborDayInCurrentWeek(sourceDueAt);
    const expectedDueAt = new Date(targetDayDate);
    const sourceDate = new Date(sourceDueAt);
    expectedDueAt.setHours(
      sourceDate.getHours(),
      sourceDate.getMinutes(),
      sourceDate.getSeconds(),
      sourceDate.getMilliseconds(),
    );

    taskState.tasks = [
      makeTask({
        id: "calendar-move",
        title: "Přesunout betonáž",
        dueAt: sourceDueAt,
      }),
    ];
    taskState.updateTask.mockResolvedValue(makeTask({ id: "calendar-move", dueAt: expectedDueAt.toISOString() }));

    const { container } = render(<TasksPage />);
    selectCalendarMode(container, "Týden");

    const card = container.querySelector('[data-help-id="todo-calendar-task"]');
    const targetDay = container.querySelector(
      `[data-help-id="todo-calendar-day"][data-date="${dateKey(targetDayDate)}"]`,
    );
    const dragData: Record<string, string> = {};
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn((type: string, value: string) => {
        dragData[type] = value;
      }),
      getData: vi.fn((type: string) => dragData[type] ?? ""),
    };

    expect(card).not.toBeNull();
    expect(targetDay).not.toBeNull();

    fireEvent.dragStart(card as HTMLElement, { dataTransfer });
    fireEvent.dragOver(targetDay as HTMLElement, { dataTransfer });
    expect(targetDay).toHaveAttribute("data-drop-target", "true");
    fireEvent.drop(targetDay as HTMLElement, { dataTransfer });

    await waitFor(() => {
      expect(taskState.updateTask).toHaveBeenCalledWith({
        id: "calendar-move",
        input: { dueAt: expectedDueAt.toISOString() },
      });
    });
  });

  it("povolí drop kalendářové aktivity podle dataTransfer payloadu i bez aktuálního drag state", async () => {
    const taskDragDataType = "application/x-tender-flow-task-id";
    const sourceDueAt = todayAt(10, 15);
    const targetDayDate = getNeighborDayInCurrentWeek(sourceDueAt);
    const expectedDueAt = new Date(targetDayDate);
    const sourceDate = new Date(sourceDueAt);
    expectedDueAt.setHours(
      sourceDate.getHours(),
      sourceDate.getMinutes(),
      sourceDate.getSeconds(),
      sourceDate.getMilliseconds(),
    );

    taskState.tasks = [
      makeTask({
        id: "payload-calendar-move",
        title: "Přesunout přes payload",
        dueAt: sourceDueAt,
      }),
    ];
    taskState.updateTask.mockResolvedValue(
      makeTask({ id: "payload-calendar-move", dueAt: expectedDueAt.toISOString() }),
    );

    const { container } = render(<TasksPage />);
    selectCalendarMode(container, "Týden");

    const targetDay = container.querySelector(
      `[data-help-id="todo-calendar-day"][data-date="${dateKey(targetDayDate)}"]`,
    );
    const dragData: Record<string, string> = {
      [taskDragDataType]: "payload-calendar-move",
      "text/plain": "payload-calendar-move",
    };
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      types: [taskDragDataType, "text/plain"],
      setData: vi.fn((type: string, value: string) => {
        dragData[type] = value;
      }),
      getData: vi.fn((type: string) => dragData[type] ?? ""),
    };

    expect(targetDay).not.toBeNull();

    fireEvent.dragOver(targetDay as HTMLElement, { dataTransfer });
    expect(targetDay).toHaveAttribute("data-drop-target", "true");
    fireEvent.drop(targetDay as HTMLElement, { dataTransfer });

    await waitFor(() => {
      expect(taskState.updateTask).toHaveBeenCalledWith({
        id: "payload-calendar-move",
        input: { dueAt: expectedDueAt.toISOString() },
      });
    });
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
