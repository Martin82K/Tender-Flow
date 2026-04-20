import React, { useEffect, useState } from "react";
import { Modal } from "@shared/ui/Modal";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { useProjectsQuery } from "@/hooks/queries/useProjectsQuery";
import {
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useUpdateTaskMutation,
} from "../hooks/useTaskMutations";
import type {
  Task,
  TaskCreateInput,
  TaskPriority,
  TaskRelatedEntity,
} from "../types";

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task;
  defaults?: Partial<TaskCreateInput>;
}

interface FormState {
  title: string;
  note: string;
  dueAt: string;
  priority: TaskPriority | "";
  projectId: string;
  relatedEntity: TaskRelatedEntity | undefined;
}

const emptyState: FormState = {
  title: "",
  note: "",
  dueAt: "",
  priority: "",
  projectId: "",
  relatedEntity: undefined,
};

const taskToState = (task: Task): FormState => ({
  title: task.title,
  note: task.note ?? "",
  dueAt: task.dueAt ? task.dueAt.slice(0, 16) : "",
  priority: task.priority ?? "",
  projectId: task.projectId ?? "",
  relatedEntity: task.relatedEntity,
});

const defaultsToState = (defaults?: Partial<TaskCreateInput>): FormState => ({
  ...emptyState,
  title: defaults?.title ?? "",
  note: defaults?.note ?? "",
  dueAt: defaults?.dueAt ? defaults.dueAt.slice(0, 16) : "",
  priority: defaults?.priority ?? "",
  projectId: defaults?.projectId ?? "",
  relatedEntity: defaults?.relatedEntity,
});

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  task,
  defaults,
}) => {
  const [state, setState] = useState<FormState>(emptyState);
  const [error, setError] = useState<string | null>(null);
  const projects = useProjectsQuery();
  const createMutation = useCreateTaskMutation();
  const updateMutation = useUpdateTaskMutation();
  const deleteMutation = useDeleteTaskMutation();

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setState(task ? taskToState(task) : defaultsToState(defaults));
  }, [isOpen, task, defaults]);

  const isEdit = Boolean(task);
  const submitting =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = state.title.trim();
    if (!title) {
      setError("Název úkolu je povinný.");
      return;
    }

    const payload = {
      title,
      note: state.note.trim() || undefined,
      dueAt: state.dueAt ? new Date(state.dueAt).toISOString() : undefined,
      priority: (state.priority === "" ? undefined : state.priority) as
        | TaskPriority
        | undefined,
      projectId: state.projectId || undefined,
      relatedEntity: state.relatedEntity,
    };

    try {
      if (task) {
        await updateMutation.mutateAsync({
          id: task.id,
          input: {
            title,
            note: payload.note ?? null,
            dueAt: payload.dueAt ?? null,
            priority: payload.priority ?? null,
            projectId: payload.projectId ?? null,
            relatedEntity: payload.relatedEntity ?? null,
          },
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      console.error("Task save failed", err);
      setError(err instanceof Error ? err.message : "Uložení úkolu selhalo.");
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!window.confirm(`Smazat úkol „${task.title}"?`)) return;
    try {
      await deleteMutation.mutateAsync(task.id);
      onClose();
    } catch (err) {
      console.error("Task delete failed", err);
      setError(err instanceof Error ? err.message : "Smazání úkolu selhalo.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Upravit úkol" : "Nový úkol"}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Název úkolu"
          value={state.title}
          onChange={(e) => handleChange("title", e.target.value)}
          placeholder="Např. Zavolat Metrostavu kvůli izolaci"
          autoFocus
          required
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Poznámka
          </label>
          <textarea
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            rows={3}
            value={state.note}
            onChange={(e) => handleChange("note", e.target.value)}
            placeholder="Volitelný detail (markdown)"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Termín
            </label>
            <input
              type="datetime-local"
              className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              value={state.dueAt}
              onChange={(e) => handleChange("dueAt", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Priorita
            </label>
            <select
              className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              value={state.priority === "" ? "" : String(state.priority)}
              onChange={(e) =>
                handleChange(
                  "priority",
                  e.target.value === "" ? "" : (Number(e.target.value) as TaskPriority),
                )
              }
            >
              <option value="">Žádná</option>
              <option value="1">1 — Urgentní</option>
              <option value="2">2 — Vysoká</option>
              <option value="3">3 — Střední</option>
              <option value="4">4 — Nízká</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Zakázka
          </label>
          <select
            className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            value={state.projectId}
            onChange={(e) => {
              const next = e.target.value;
              handleChange("projectId", next);
              if (!next) handleChange("relatedEntity", undefined);
            }}
          >
            <option value="">— Bez zakázky —</option>
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {state.relatedEntity && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Vazba: {state.relatedEntity.type}:{state.relatedEntity.id}
              <button
                type="button"
                className="ml-2 text-primary underline"
                onClick={() => handleChange("relatedEntity", undefined)}
              >
                odebrat
              </button>
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-2 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div>
            {isEdit && (
              <Button type="button" variant="danger" size="sm" onClick={handleDelete} disabled={submitting}>
                Smazat
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Zrušit
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              {isEdit ? "Uložit" : "Vytvořit"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
