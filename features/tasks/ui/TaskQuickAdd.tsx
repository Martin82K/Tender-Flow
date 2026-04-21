import React, { useState, useRef } from "react";
import { useCreateTaskMutation } from "../hooks/useTaskMutations";
import type { TaskRelatedEntity } from "../types";

interface TaskQuickAddProps {
  projectId?: string;
  relatedEntity?: TaskRelatedEntity;
  placeholder?: string;
  onCreated?: () => void;
}

export const TaskQuickAdd: React.FC<TaskQuickAddProps> = ({
  projectId,
  relatedEntity,
  placeholder = "+ Přidat úkol…",
  onCreated,
}) => {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useCreateTaskMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = title.trim();
    if (!value || submitting) return;

    setSubmitting(true);
    try {
      await mutation.mutateAsync({ title: value, projectId, relatedEntity });
      setTitle("");
      onCreated?.();
      inputRef.current?.focus();
    } catch (err) {
      console.error("Task creation failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="cc-task-quickadd">
      <input
        ref={inputRef}
        type="text"
        className="cc-task-quickadd__input"
        placeholder={placeholder}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={submitting}
        aria-label="Nový úkol"
      />
      {title.trim().length > 0 && (
        <button
          type="submit"
          className="cc-task-quickadd__submit"
          disabled={submitting}
        >
          {submitting ? "…" : "Přidat"}
        </button>
      )}
    </form>
  );
};
