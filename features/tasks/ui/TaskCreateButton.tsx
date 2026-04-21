import React, { useState } from "react";
import { useFeatures } from "@/context/FeatureContext";
import { FEATURES } from "@/config/features";
import { TaskFormModal } from "./TaskFormModal";
import type { TaskRelatedEntity } from "../types";

interface TaskCreateButtonProps {
  projectId?: string;
  relatedEntity?: TaskRelatedEntity;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Kontextové „+ Úkol" tlačítko. Předvyplní projectId a relatedEntity ve formuláři.
 * Gated feature flagem MODULE_TASKS — mimo povolený tier se nerenderuje.
 */
export const TaskCreateButton: React.FC<TaskCreateButtonProps> = ({
  projectId,
  relatedEntity,
  title,
  className,
  children,
}) => {
  const { hasFeature } = useFeatures();
  const [open, setOpen] = useState(false);

  if (!hasFeature(FEATURES.MODULE_TASKS)) return null;

  return (
    <>
      <button
        type="button"
        className={
          className ??
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
        }
        onClick={() => setOpen(true)}
        aria-label="Vytvořit úkol"
      >
        <span className="material-symbols-outlined text-sm">add_task</span>
        {children ?? "Úkol"}
      </button>

      <TaskFormModal
        isOpen={open}
        onClose={() => setOpen(false)}
        defaults={{ title, projectId, relatedEntity }}
      />
    </>
  );
};
