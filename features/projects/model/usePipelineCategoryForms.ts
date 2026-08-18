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
  getLocalBudgetAttachments,
  saveLocalBudgetAttachments,
} from "./budgetAttachmentLocalStore";
import { getCategoryBudgetAttachments } from "./budgetAttachmentModel";

interface PipelineCategoryFormData {
  title: string;
  sodBudget: string;
  planBudget: string;
  description: string;
  workItems: string[];
  budgetAttachments?: BudgetAttachment[];
  pendingBudgetAttachments?: PendingBudgetAttachment[];
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
      { ...formData, budgetAttachments: [] },
      categoryId,
      [],
    );
    let categoryCreated = false;

    try {
      await onAddCategory(newCategory);
      categoryCreated = true;

      const attachments = [...(formData.budgetAttachments || [])];
      const attachmentFailures: string[] = [];
      if (formData.pendingBudgetAttachments?.length) {
        if (!resolveDesktopTenderFolderPath) {
          throw new Error("Nelze určit složku nového VŘ.");
        }
        const tenderFolderPath = await resolveDesktopTenderFolderPath(newCategory.title);
        if (!tenderFolderPath) {
          throw new Error("Složka nového VŘ nebyla vytvořena.");
        }
        for (const pendingAttachment of formData.pendingBudgetAttachments) {
          try {
            attachments.push(
              await copyPendingBudgetAttachment(tenderFolderPath, pendingAttachment),
            );
          } catch (error) {
            attachmentFailures.push(
              `${pendingAttachment.fileName}: ${
                error instanceof Error ? error.message : "kopírování selhalo"
              }`,
            );
          }
        }
      }

      if (attachments.length > 0) {
        saveLocalBudgetAttachments(projectId, categoryId, attachments);
        queryClient.setQueryData<ProjectDetails>(
          PROJECT_DETAILS_KEYS.detail(projectId),
          (current) => current
            ? {
                ...current,
                categories: current.categories.map((category) =>
                  category.id === categoryId
                    ? {
                        ...category,
                        budgetAttachments: attachments,
                        budgetAttachment: attachments[0],
                      }
                    : category,
                ),
              }
            : current,
        );
      }
      if (attachmentFailures.length > 0) {
        showAlert({
          title:
            attachments.length > 0
              ? "VŘ vytvořeno s neúplnými přílohami"
              : "VŘ vytvořeno bez přílohy",
          message: `Některé přílohy se nepodařilo připojit: ${attachmentFailures.join("; ")}`,
          variant: "danger",
        });
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

    saveLocalBudgetAttachments(
      projectId,
      editingCategory.id,
      formData.budgetAttachments,
    );
    onEditCategory(updatedCategory);
    setEditingCategory(null);
    setIsEditModalOpen(false);
  };

  const handleEditCategoryClick = async (category: DemandCategory) => {
    setEditingCategory({
      ...category,
      budgetAttachments: (() => {
        const localAttachments = getLocalBudgetAttachments(projectId, category.id);
        return localAttachments.length > 0
          ? localAttachments
          : getCategoryBudgetAttachments(category);
      })(),
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
