import { useState } from "react";
import type { DemandCategory, DemandDocument } from "@/types";
import { fetchLinkedTenderPlanDates } from "@/features/projects/api";
import { uploadDocument } from "@/services/documentService";
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
    files: File[],
  ) => {
    if (!onAddCategory) return;

    const categoryId = `cat_${Date.now()}`;

    let uploadedDocuments: DemandDocument[] = [];
    if (files.length > 0) {
      try {
        uploadedDocuments = await Promise.all(
          files.map((file) => uploadDocument(file, categoryId)),
        );
      } catch (error) {
        console.error("Error uploading documents:", error);
        showAlert({
          title: "Chyba",
          message: "Chyba při nahrávání dokumentů. Zkuste to prosím znovu.",
          variant: "danger",
        });
        return;
      }
    }

    const newCategory = buildNewDemandCategory(formData, categoryId, uploadedDocuments);
    onAddCategory(newCategory);
    setIsAddModalOpen(false);
  };

  const handleEditCategoryFromModal = async (
    formData: PipelineCategoryFormData,
    files: File[],
  ) => {
    if (!onEditCategory || !editingCategory) return;

    let uploadedDocuments: DemandDocument[] = editingCategory.documents || [];
    if (files.length > 0) {
      try {
        const newDocuments = await Promise.all(
          files.map((file) => uploadDocument(file, editingCategory.id)),
        );
        uploadedDocuments = [...uploadedDocuments, ...newDocuments];
      } catch (error) {
        console.error("Error uploading documents:", error);
        showAlert({
          title: "Chyba",
          message: "Chyba při nahrávání dokumentů. Zkuste to prosím znovu.",
          variant: "danger",
        });
        return;
      }
    }

    const updatedCategory = buildUpdatedDemandCategory(
      editingCategory,
      formData,
      uploadedDocuments,
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
