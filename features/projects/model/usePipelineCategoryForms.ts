import { useState } from "react";
import type { BudgetAttachment, DemandCategory } from "@/types";
import { fetchLinkedTenderPlanDates } from "@/features/projects/api";
import {
  buildNewDemandCategory,
  buildUpdatedDemandCategory,
} from "./pipelineModel";

interface PipelineCategoryFormData {
  title: string;
  sodBudget: string;
  planBudget: string;
  description: string;
  workItems: string[];
  budgetAttachment?: BudgetAttachment | null;
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
  onAddCategory?: (category: DemandCategory) => void;
  onEditCategory?: (category: DemandCategory) => void;
  showAlert: (args: ShowAlertArgs) => void;
}

export const usePipelineCategoryForms = ({
  projectId,
  onAddCategory,
  onEditCategory,
  showAlert,
}: UsePipelineCategoryFormsInput) => {
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
    const newCategory = buildNewDemandCategory(formData, categoryId, []);
    onAddCategory(newCategory);
    setIsAddModalOpen(false);
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

    onEditCategory(updatedCategory);
    setEditingCategory(null);
    setIsEditModalOpen(false);
  };

  const handleEditCategoryClick = async (category: DemandCategory) => {
    setEditingCategory(category);
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
