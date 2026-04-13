import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { DemandCategory, TenderPlanItem } from "@/types";
import {
  createTenderPlan,
  createTenderPlanId,
  createTenderPlanRandomId,
  deleteTenderPlan,
  getTenderPlans,
  syncTenderPlansWithCategories,
  updateTenderPlanDates,
  updateTenderPlanItem,
} from "@/features/projects/api/tenderPlanApi";
import {
  buildImportSummaryMessage,
  findLinkedCategoryForPlan,
  getTenderPlanStatus,
  getVisibleTenderPlans,
  ImportConflict,
  planTenderImport,
  TenderPlanViewMode,
} from "./tenderPlanModel";
import { importTenderPlanFromXLSX } from "@/services/exportService";

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

interface AlertModalState {
  isOpen: boolean;
  title: string;
  message: string;
  variant: "success" | "error" | "info";
}

interface UseTenderPlanControllerInput {
  projectId: string;
  categories: DemandCategory[];
  onCreateCategory: (name: string, dateFrom: string, dateTo: string) => void;
}

export const useTenderPlanController = ({
  projectId,
  categories,
  onCreateCategory,
}: UseTenderPlanControllerInput) => {
  const [items, setItems] = useState<TenderPlanItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formName, setFormName] = useState("");
  const [formDateFrom, setFormDateFrom] = useState("");
  const [formDateTo, setFormDateTo] = useState("");

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const [alertModal, setAlertModal] = useState<AlertModalState>({
    isOpen: false,
    title: "",
    message: "",
    variant: "info",
  });

  const [importConflicts, setImportConflicts] = useState<ImportConflict[]>([]);
  const [importStats, setImportStats] = useState({
    imported: 0,
    updated: 0,
    skipped: 0,
  });

  const [viewMode, setViewMode] = useState<TenderPlanViewMode>("all");

  const closeConfirmModal = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  };

  const closeAlertModal = () => {
    setAlertModal((prev) => ({ ...prev, isOpen: false }));
  };

  const resetForm = () => {
    setFormName("");
    setFormDateFrom("");
    setFormDateTo("");
    setIsAdding(false);
    setEditingId(null);
  };

  useEffect(() => {
    const loadItems = async () => {
      setIsLoading(true);
      try {
        const loadedItems = await getTenderPlans(projectId);
        setItems(loadedItems);
      } catch (error) {
        console.error("Unexpected error loading tender plans:", error);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadItems();
  }, [projectId]);

  const findLinkedCategory = (item: TenderPlanItem): DemandCategory | undefined => {
    return findLinkedCategoryForPlan(item, categories);
  };

  const getStatus = (item: TenderPlanItem) => {
    return getTenderPlanStatus(item, categories);
  };

  const handleAdd = async () => {
    if (!formName.trim()) return;

    const newItem: TenderPlanItem = {
      id: createTenderPlanId(),
      name: formName.trim(),
      dateFrom: formDateFrom,
      dateTo: formDateTo,
    };

    setItems((prev) => [...prev, newItem]);
    resetForm();

    try {
      await createTenderPlan({
        id: newItem.id,
        projectId,
        name: newItem.name,
        dateFrom: newItem.dateFrom || null,
        dateTo: newItem.dateTo || null,
      });
    } catch (error) {
      console.error("Unexpected error inserting tender plan:", error);
      setItems((prev) => prev.filter((item) => item.id !== newItem.id));
    }
  };

  const handleEdit = (item: TenderPlanItem) => {
    setEditingId(item.id);
    setFormName(item.name);
    setFormDateFrom(item.dateFrom);
    setFormDateTo(item.dateTo);
  };

  const handleUpdate = async () => {
    if (!editingId || !formName.trim()) return;

    const updatedData = {
      name: formName.trim(),
      dateFrom: formDateFrom,
      dateTo: formDateTo,
    };

    setItems((prev) =>
      prev.map((item) =>
        item.id === editingId
          ? { ...item, ...updatedData }
          : item,
      ),
    );

    const previousItems = items;
    resetForm();

    try {
      await updateTenderPlanItem({
        id: editingId,
        name: updatedData.name,
        dateFrom: updatedData.dateFrom || null,
        dateTo: updatedData.dateTo || null,
      });
    } catch (error) {
      console.error("Unexpected error updating tender plan:", error);
      setItems(previousItems);
    }
  };

  const executeDelete = async (id: string) => {
    closeConfirmModal();

    const previousItems = items;
    setItems((prev) => prev.filter((item) => item.id !== id));

    try {
      await deleteTenderPlan(id);
    } catch (error) {
      console.error("Unexpected error deleting tender plan:", error);
      setItems(previousItems);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Smazat plán",
      message: "Opravdu smazat tento plán? Tato akce je nevratná.",
      onConfirm: () => {
        void executeDelete(id);
      },
    });
  };

  const handleCreateCategory = (item: TenderPlanItem) => {
    onCreateCategory(item.name, item.dateFrom, item.dateTo);
  };

  const handleSyncExisting = async () => {
    setIsLoading(true);
    try {
      const { createdCount, linkedCount } = await syncTenderPlansWithCategories({
        projectId,
        categories,
        currentItems: items,
      });

      if (createdCount > 0 || linkedCount > 0) {
        const refreshedItems = await getTenderPlans(projectId);
        setItems(refreshedItems);
        setAlertModal({
          isOpen: true,
          title: "Synchronizace dokončena",
          message: `Vytvořeno ${createdCount}, Propojeno ${linkedCount} položek.`,
          variant: "success",
        });
      } else {
        setAlertModal({
          isOpen: true,
          title: "Synchronizace",
          message: "Vše je již synchronizováno.",
          variant: "info",
        });
      }
    } catch (error) {
      console.error("Error during manual sync:", error);
      setAlertModal({
        isOpen: true,
        title: "Chyba",
        message: "Chyba při synchronizaci.",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    const currentStats = { imported: 0, updated: 0, skipped: 0 };
    setImportStats(currentStats);
    setImportConflicts([]);

    try {
      const parsedItems = await importTenderPlanFromXLSX(file);

      if (parsedItems.length === 0) {
        setAlertModal({
          isOpen: true,
          title: "Chyba importu",
          message: "Nepodařilo se načíst žádná data. Zkontrolujte formát souboru.",
          variant: "error",
        });
        setIsLoading(false);
        return;
      }

      let existingItems = items;
      try {
        existingItems = await getTenderPlans(projectId);
        setItems(existingItems);
      } catch (error) {
        console.warn(
          "Unable to refresh existing tender plans before import:",
          error,
        );
      }

      const validItems = parsedItems
        .filter((item): item is Partial<TenderPlanItem> & { name: string; dateFrom: string; dateTo: string } =>
          typeof item.name === "string" && typeof item.dateFrom === "string" && typeof item.dateTo === "string"
        );
      const plannedImport = planTenderImport(validItems, existingItems);
      currentStats.skipped += plannedImport.skipped;

      for (const row of plannedImport.rowsToCreate) {
        const newItemId = createTenderPlanRandomId();
        try {
          await createTenderPlan({
            id: newItemId,
            projectId,
            name: row.name,
            dateFrom: row.dateFrom || null,
            dateTo: row.dateTo || null,
          });

          currentStats.imported++;
          setItems((prev) => [
            ...prev,
            {
              id: newItemId,
              name: row.name,
              dateFrom: row.dateFrom,
              dateTo: row.dateTo,
            },
          ]);
        } catch (error) {
          console.error("Error inserting tender plan during import:", error);
          currentStats.skipped++;
        }
      }

      setImportStats(currentStats);
      setImportConflicts(plannedImport.conflicts);

      if (plannedImport.conflicts.length === 0) {
        setAlertModal({
          isOpen: true,
          title: "Import dokončen",
          message: buildImportSummaryMessage(currentStats),
          variant: "success",
        });
      }
    } catch (error) {
      console.error("Error importing file:", error);
      setAlertModal({
        isOpen: true,
        title: "Chyba",
        message: "Chyba při importu souboru.",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const resolveConflict = async (action: "overwrite" | "skip") => {
    const conflict = importConflicts[0];
    if (!conflict) return;

    const nextStats = { ...importStats };

    if (action === "overwrite") {
      try {
        await updateTenderPlanDates(
          conflict.existingItem.id,
          conflict.importItem.dateFrom || null,
          conflict.importItem.dateTo || null,
        );

        nextStats.updated++;
        setItems((prev) =>
          prev.map((item) =>
            item.id === conflict.existingItem.id
              ? {
                  ...item,
                  dateFrom: conflict.importItem.dateFrom,
                  dateTo: conflict.importItem.dateTo,
                }
              : item,
          ),
        );
      } catch (error) {
        console.error(
          "Error updating tender plan during conflict resolution:",
          error,
        );
        nextStats.skipped++;
      }
    } else {
      nextStats.skipped++;
    }

    setImportStats(nextStats);
    const remaining = importConflicts.slice(1);
    setImportConflicts(remaining);

    if (remaining.length === 0) {
      setAlertModal({
        isOpen: true,
        title: "Import dokončen",
        message: buildImportSummaryMessage(nextStats),
        variant: "success",
      });
    }
  };

  const visibleItems = useMemo(
    () => getVisibleTenderPlans(items, categories, viewMode),
    [items, categories, viewMode],
  );

  return {
    items,
    isAdding,
    setIsAdding,
    editingId,
    isLoading,
    fileInputRef,
    formName,
    setFormName,
    formDateFrom,
    setFormDateFrom,
    formDateTo,
    setFormDateTo,
    confirmModal,
    closeConfirmModal,
    alertModal,
    closeAlertModal,
    importConflicts,
    viewMode,
    setViewMode,
    resolveConflict,
    findLinkedCategory,
    getStatus,
    handleAdd,
    handleEdit,
    handleUpdate,
    handleDelete,
    handleCreateCategory,
    resetForm,
    handleSyncExisting,
    handleImportClick,
    handleFileChange,
    visibleItems,
  };
};
