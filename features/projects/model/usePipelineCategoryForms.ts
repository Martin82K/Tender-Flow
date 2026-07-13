import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { BudgetAttachment, DemandCategory } from "@/types";
import type { ProjectDetails } from "@/types";
import { fetchLinkedTenderPlanDates } from "@/features/projects/api";
import { PROJECT_DETAILS_KEYS } from "@features/projects/hooks/useProjectDetailsQuery";
import {
  copyPendingBudgetAttachment,
  type PendingBudgetAttachment,
} from "@/services/budgetAttachmentService";
import {
  buildNewDemandCategory,
  buildUpdatedDemandCategory,
} from "./pipelineModel";
import {
  getLocalBudgetAttachment,
  saveLocalBudgetAttachment,
} from "./budgetAttachmentLocalStore";

interface PipelineCategoryFormData {
  title: string;
  sodBudget: string;
  planBudget: string;
  description: string;
  workItems: string[];
  budgetAttachment?: BudgetAttachment | null;
  pendingBudgetAttachment?: PendingBudgetAttachment | null;
  deadline: string;
  realizationStart: string;
  realizationEnd: string;
}

interface ShowAlertArgs {
  title: string;
  message: string;
  variant?: "danger" | "info" | "success";
}

interface UsePipelineCategoryFormsInput {
  projectId: string;
  onAddCategory?: (category: DemandCategory) => Promise<void>;
  onEditCategory?: (category: DemandCategory) => void | Promise<void>;
  resolveDesktopTenderFolderPath?: (categoryTitle: string) => Promise<string | null>;
  showAlert: (args: ShowAlertArgs) => void;
}

export const usePipelineCategoryForms = ({
  projectId,
  onAddCategory,
  onEditCategory,
  resolveDesktopTenderFolderPath,
  showAlert,
}: UsePipelineCategoryFormsInput) => {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DemandCategory | null>(
    null,
  );
  const [linkedTenderPlanDates, setLinkedTenderPlanDates] = useState<{
    dateFrom: string;
    dateTo: string;
  } | null>(null);

  const handleCreateCategoryFromModal = async (
    formData: PipelineCategoryFormData,
  ) => {
    if (!onAddCategory) return;

    const categoryId = `cat_${Date.now()}`;
    const newCategory = buildNewDemandCategory(
      { ...formData, budgetAttachment: null },
      categoryId,
      [],
    );
    let categoryCreated = false;

    try {
      await onAddCategory(newCategory);
      categoryCreated = true;

      let attachment = formData.budgetAttachment || null;
      if (formData.pendingBudgetAttachment) {
        if (!resolveDesktopTenderFolderPath) {
          throw new Error("Nelze určit složku nového VŘ.");
        }
        const tenderFolderPath = await resolveDesktopTenderFolderPath(newCategory.title);
        if (!tenderFolderPath) {
          throw new Error("Složka nového VŘ nebyla vytvořena.");
        }
        attachment = await copyPendingBudgetAttachment(
          tenderFolderPath,
          formData.pendingBudgetAttachment,
        );
      }

      saveLocalBudgetAttachment(projectId, categoryId, attachment);
      if (attachment) {
        queryClient.setQueryData<ProjectDetails>(
          PROJECT_DETAILS_KEYS.detail(projectId),
          (current) => current
            ? {
                ...current,
                categories: current.categories.map((category) =>
                  category.id === categoryId
                    ? { ...category, budgetAttachment: attachment }
                    : category,
                ),
              }
            : current,
        );
      }
      setIsAddModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Neznámá chyba";
      showAlert({
        title: categoryCreated
          ? "VŘ vytvořeno bez přílohy"
          : "VŘ se nepodařilo vytvořit",
        message: categoryCreated
          ? `Výběrové řízení bylo vytvořeno, ale přílohu se nepodařilo připojit: ${message}`
          : message,
        variant: "danger",
      });
      if (categoryCreated) setIsAddModalOpen(false);
    }
  };

  const handleEditCategoryFromModal = async (
    formData: PipelineCategoryFormData,
  ) => {
    if (!onEditCategory || !editingCategory) return;

    const updatedCategory = buildUpdatedDemandCategory(
      editingCategory,
      formData,
      editingCategory.documents || [],
    );

    saveLocalBudgetAttachment(projectId, editingCategory.id, formData.budgetAttachment);
    onEditCategory(updatedCategory);
    setEditingCategory(null);
    setIsEditModalOpen(false);
  };

  const handleEditCategoryClick = async (category: DemandCategory) => {
    setEditingCategory({
      ...category,
      budgetAttachment:
        getLocalBudgetAttachment(projectId, category.id) ||
        category.budgetAttachment ||
        undefined,
    });
    setLinkedTenderPlanDates(null);
    setIsEditModalOpen(true);

    try {
      const linkedDates = await fetchLinkedTenderPlanDates(
        projectId,
        category.id,
        category.title,
      );
      if (linkedDates) {
        setLinkedTenderPlanDates(linkedDates);
      }
    } catch {
      console.debug("No linked tender plan found for category:", category.id);
    }
  };

  const handleToggleCategoryComplete = (category: DemandCategory) => {
    const newStatus = category.status === "closed" ? "open" : "closed";
    const updatedCategory: DemandCategory = {
      ...category,
      status: newStatus,
    };
    onEditCategory?.(updatedCategory);
  };

  const closeEditCategoryModal = () => {
    setIsEditModalOpen(false);
    setEditingCategory(null);
    setLinkedTenderPlanDates(null);
  };

  return {
    isAddModalOpen,
    setIsAddModalOpen,
    isEditModalOpen,
    setIsEditModalOpen,
    editingCategory,
    linkedTenderPlanDates,
    handleCreateCategoryFromModal,
    handleEditCategoryFromModal,
    handleEditCategoryClick,
    handleToggleCategoryComplete,
    closeEditCategoryModal,
  };
};
