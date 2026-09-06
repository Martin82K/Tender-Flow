import React, { useEffect, useRef, useState } from "react";
import { Button } from "@shared/ui/Button";
import { ConfirmationModal } from "@shared/ui/ConfirmationModal";
import { getTodoProjectRootCount, type TaskWithSubtasks } from "../model/taskTree";
import { useCreateTodoProjectMutation, useDeleteTodoProjectMutation, useUpdateTodoProjectMutation } from "../hooks/useTaskProjectMutations";
import type { TodoProject } from "../types";
import { TASK_MENU_PROJECT_BASE } from "./taskPresentation";
import { TODO_PROJECT_COLORS } from "./taskCalendarUtils";

interface TodoProjectSectionProps {
  projects: TodoProject[];
  selectedTodoProjectId: string | null;
  taskTree: TaskWithSubtasks[];
  onSelectProject: (projectId: string) => void;
  onProjectDeleted: (projectId: string) => void;
}

export const TodoProjectSection: React.FC<TodoProjectSectionProps> = ({
  projects,
  selectedTodoProjectId,
  taskTree,
  onSelectProject,
  onProjectDeleted,
}) => {
  const createProject = useCreateTodoProjectMutation();
  const updateProject = useUpdateTodoProjectMutation();
  const deleteProject = useDeleteTodoProjectMutation();
  const [name, setName] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TodoProject | null>(null);
  const [menuState, setMenuState] = useState<{
    project: TodoProject;
    position: { x: number; y: number };
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuState) return;

    const handlePointer = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuState(null);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuState(null);
    };
    const handleScroll = () => setMenuState(null);

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [menuState]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = name.trim();
    if (!value || createProject.isPending) return;

    await createProject.mutateAsync({
      name: value,
      sortOrder: projects.length,
    });
    setName("");
  };

  const openContextMenu = (
    event: React.MouseEvent | React.KeyboardEvent,
    project: TodoProject,
  ) => {
    event.preventDefault();
    const position =
      "clientX" in event
        ? { x: event.clientX, y: event.clientY }
        : {
            x: event.currentTarget.getBoundingClientRect().left + 24,
            y: event.currentTarget.getBoundingClientRect().bottom + 4,
          };

    setMenuState({ project, position });
  };

  const startEditingProject = (project: TodoProject) => {
    setEditingProjectId(project.id);
    setEditingName(project.name);
    setEditingColor(project.color ?? null);
    setMenuState(null);
  };

  const handleChangeProjectColor = async (project: TodoProject, color: string | null) => {
    const nextColor = color ?? null;
    if ((project.color ?? null) === nextColor || updateProject.isPending) {
      setMenuState(null);
      return;
    }

    await updateProject.mutateAsync({
      id: project.id,
      input: { color: nextColor },
    });
    setMenuState(null);
  };

  const cancelEditingProject = () => {
    setEditingProjectId(null);
    setEditingName("");
    setEditingColor(null);
  };

  const handleRenameProject = async (event: React.FormEvent, project: TodoProject) => {
    event.preventDefault();
    const value = editingName.trim();
    const colorChanged = (editingColor ?? null) !== (project.color ?? null);
    const nameChanged = value !== project.name;
    if (!value || (!nameChanged && !colorChanged) || updateProject.isPending) {
      cancelEditingProject();
      return;
    }

    await updateProject.mutateAsync({
      id: project.id,
      input: {
        ...(nameChanged ? { name: value } : {}),
        ...(colorChanged ? { color: editingColor } : {}),
      },
    });
    cancelEditingProject();
  };

  const handleConfirmDeleteProject = async () => {
    if (!deleteTarget || deleteProject.isPending) return;

    const projectId = deleteTarget.id;
    await deleteProject.mutateAsync(projectId);
    onProjectDeleted(projectId);
    if (editingProjectId === projectId) {
      cancelEditingProject();
    }
    setDeleteTarget(null);
  };

  const menuLeft = menuState
    ? Math.max(8, Math.min(menuState.position.x, (typeof window === "undefined" ? 240 : window.innerWidth) - 220))
    : 0;
  const menuTop = menuState
    ? Math.max(8, Math.min(menuState.position.y, (typeof window === "undefined" ? 240 : window.innerHeight) - 208))
    : 0;

  return (
    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between gap-2 px-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Moje projekty
        </h3>
      </div>

      <div className="space-y-1">
        {projects.map((project) => {
          const active = selectedTodoProjectId === project.id;
          const editing = editingProjectId === project.id;

          if (editing) {
            return (
              <form
                key={project.id}
                onSubmit={(event) => handleRenameProject(event, project)}
                className="space-y-2 rounded-lg border border-primary/40 bg-slate-50 px-2 py-1.5 shadow-sm dark:bg-slate-900"
              >
                <div className="flex items-center gap-1">
                  <span
                    className="text-base font-black"
                    style={{ color: editingColor ?? "var(--color-primary, #f97316)" }}
                    aria-hidden
                  >
                    #
                  </span>
                  <input
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEditingProject();
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none dark:text-slate-100"
                    aria-label="Název TODO projektu"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="inline-flex size-7 items-center justify-center rounded-md text-primary transition hover:bg-primary/10 disabled:opacity-40"
                    disabled={!editingName.trim() || updateProject.isPending}
                    aria-label="Uložit TODO projekt"
                    title="Uložit název a barvu TODO projektu"
                  >
                    <span className="material-symbols-outlined text-[17px]" aria-hidden>
                      check
                    </span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200 dark:hover:bg-slate-800"
                    onClick={cancelEditingProject}
                    aria-label="Zrušit editaci TODO projektu"
                    title="Zrušit editaci TODO projektu"
                  >
                    <span className="material-symbols-outlined text-[17px]" aria-hidden>
                      close
                    </span>
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pl-4" aria-label="Barva TODO projektu">
                  <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Barva
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingColor(null)}
                    aria-pressed={editingColor === null}
                    data-active={editingColor === null ? "true" : "false"}
                    className="inline-flex size-6 items-center justify-center rounded-md border border-slate-300 text-[11px] font-bold text-slate-500 transition data-[active=true]:ring-2 data-[active=true]:ring-primary dark:border-slate-600"
                    aria-label="Výchozí barva"
                    title="Použít výchozí barvu TODO projektu"
                  >
                    ×
                  </button>
                  {TODO_PROJECT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditingColor(color)}
                      aria-pressed={editingColor === color}
                      data-active={editingColor === color ? "true" : "false"}
                      className="inline-flex size-6 items-center justify-center rounded-md border border-slate-300 transition data-[active=true]:ring-2 data-[active=true]:ring-primary dark:border-slate-600"
                      aria-label={`Barva ${color}`}
                      title={`Nastavit barvu TODO projektu na ${color}`}
                    >
                      <span
                        className="block size-3.5 rounded-full shadow-sm"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
              </form>
            );
          }

          return (
            <button
              key={project.id}
              type="button"
              data-active={active ? "true" : "false"}
              data-help-id="todo-project-item"
              aria-current={active ? "page" : undefined}
              onClick={() => onSelectProject(project.id)}
              onContextMenu={(event) => openContextMenu(event, project)}
              onKeyDown={(event) => {
                if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                  openContextMenu(event, project);
                }
              }}
              className={`${TASK_MENU_PROJECT_BASE} ${
                active
                  ? "border-orange-300 bg-orange-50 text-orange-700 shadow-sm dark:border-orange-900/70 dark:bg-orange-950/30 dark:text-orange-200"
                  : "border-transparent hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-800/70"
              }`}
              title={`Zobrazit TODO projekt "${project.name}". Pravým tlačítkem otevřete akce projektu.`}
            >
              <span
                className={`text-primary ${active ? "font-black" : ""}`}
                style={project.color ? { color: project.color } : undefined}
                aria-hidden
              >
                #
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
              <span className="text-xs text-slate-500">{getTodoProjectRootCount(taskTree, project.id)}</span>
            </button>
          );
        })}
      </div>

      {menuState && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Akce TODO projektu"
          data-help-id="todo-project-context-menu"
          className="fixed z-[80] w-[264px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
          style={{ left: menuLeft, top: menuTop }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => startEditingProject(menuState.project)}
            title="Upravit název nebo barvu TODO projektu"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              edit
            </span>
            Upravit projekt
          </button>
          <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-700">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                palette
              </span>
              Změnit barvu
            </div>
            <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Změnit barvu TODO projektu">
              <button
                type="button"
                onClick={() => void handleChangeProjectColor(menuState.project, null)}
                aria-pressed={!menuState.project.color}
                data-active={!menuState.project.color ? "true" : "false"}
                className="inline-flex size-7 items-center justify-center rounded-md border border-slate-300 text-[12px] font-bold text-slate-500 transition hover:bg-slate-50 data-[active=true]:ring-2 data-[active=true]:ring-primary dark:border-slate-600 dark:hover:bg-slate-800"
                aria-label="Výchozí barva projektu"
                title="Nastavit výchozí barvu projektu"
                disabled={updateProject.isPending}
              >
                ×
              </button>
              {TODO_PROJECT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => void handleChangeProjectColor(menuState.project, color)}
                  aria-pressed={menuState.project.color === color}
                  data-active={menuState.project.color === color ? "true" : "false"}
                  className="inline-flex size-7 items-center justify-center rounded-md border border-slate-300 transition hover:bg-slate-50 data-[active=true]:ring-2 data-[active=true]:ring-primary dark:border-slate-600 dark:hover:bg-slate-800"
                  aria-label={`Změnit barvu projektu na ${color}`}
                  title={`Změnit barvu projektu na ${color}`}
                  disabled={updateProject.isPending}
                >
                  <span
                    className="block size-4 rounded-full shadow-sm"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setDeleteTarget(menuState.project);
              setMenuState(null);
            }}
            title="Smazat TODO projekt"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              delete
            </span>
            Smazat projekt
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2 px-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nový projekt..."
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          aria-label="Nový TODO projekt"
        />
        <Button type="submit" size="sm" variant="outline" disabled={!name.trim()} isLoading={createProject.isPending} title="Přidat nový TODO projekt">
          Přidat
        </Button>
      </form>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title="Smazat TODO projekt?"
        message={
          deleteTarget
            ? `Projekt "${deleteTarget.name}" bude smazán. Úkoly zůstanou zachované a přesunou se do "Bez TODO projektu".`
            : ""
        }
        confirmLabel="Smazat projekt"
        cancelLabel="Zrušit"
        onConfirm={handleConfirmDeleteProject}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  );
};
