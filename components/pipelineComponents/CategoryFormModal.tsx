/**
 * CategoryFormModal Component
 * Unified modal for creating and editing demand categories.
 * Extracted from Pipeline.tsx for better modularity.
 */

import React, { useState, useEffect } from "react";
import { DemandCategory, DemandDocument } from "../../types";
import { formatInputNumber } from "../../utils/formatters";
import { formatFileSize } from "../../services/documentService";
import { uploadDocument } from "../../services/documentService";
import { AlertModal } from "../AlertModal";

export interface CategoryFormData {
  title: string;
  sodBudget: string;
  planBudget: string;
  description: string;
  workItems: string[];
  deadline: string;
  realizationStart: string;
  realizationEnd: string;
}

interface CategoryFormModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  initialData?: Partial<DemandCategory>;
  existingDocuments?: DemandDocument[];
  linkedTenderPlanDates?: { dateFrom: string; dateTo: string } | null; // Dates from linked VŘ plan
  onClose: () => void;
  onSubmit: (formData: CategoryFormData, files: File[]) => Promise<void>;
}

const initialFormState: CategoryFormData = {
  title: "",
  sodBudget: "",
  planBudget: "",
  description: "",
  workItems: [],
  deadline: "",
  realizationStart: "",
  realizationEnd: "",
};

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  isOpen,
  mode,
  initialData,
  existingDocuments = [],
  linkedTenderPlanDates,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<CategoryFormData>(initialFormState);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: "danger" | "info" | "success";
  }>({
    isOpen: false,
    title: "",
    message: "",
    variant: "info",
  });

  // Reset form when modal opens/closes or when switching between create/edit
  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        title: initialData.title || "",
        sodBudget: initialData.sodBudget?.toString() || "",
        planBudget: initialData.planBudget?.toString() || "",
        description: initialData.description || "",
        workItems:
          initialData.workItems ||
          (initialData.description ? initialData.description.split("\n") : []),
        deadline: initialData.deadline || "",
        realizationStart: initialData.realizationStart || "",
        realizationEnd: initialData.realizationEnd || "",
      });
    } else if (isOpen) {
      setFormData(initialFormState);
    }
    setSelectedFiles([]);
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Sync description with workItems if needed, or just pass both
      const submissionData = {
        ...formData,
        description: formData.workItems.join("\n"),
      };
      await onSubmit(submissionData, selectedFiles);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(
        (f: File) => f.size <= 10 * 1024 * 1024,
      );
      if (newFiles.length < e.target.files.length) {
        setAlertModal({
          isOpen: true,
          title: "Chyba nahrávání",
          message: "Některé soubory překročily limit 10MB a nebyly přidány.",
          variant: "danger",
        });
      }
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const addWorkItem = () => {
    setFormData((prev) => ({ ...prev, workItems: [...prev.workItems, ""] }));
  };

  const removeWorkItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      workItems: prev.workItems.filter((_, i) => i !== index),
    }));
  };

  const updateWorkItem = (index: number, value: string) => {
    const newItems = [...formData.workItems];
    newItems[index] = value;
    setFormData((prev) => ({ ...prev, workItems: newItems }));
  };

  if (!isOpen) return null;

  const title =
    mode === "create" ? "Nová Poptávka / Sekce" : "Upravit Poptávku";
  const submitLabel = mode === "create" ? "Vytvořit poptávku" : "Uložit změny";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700/50 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Název sekce *
              </label>
              <input
                required
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                placeholder="Např. Klempířské konstrukce"
              />
            </div>

            {/* Budgets */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Cena SOD (Investor)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatInputNumber(formData.sodBudget)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\s/g, "");
                    if (/^\d*$/.test(raw)) {
                      setFormData({ ...formData, sodBudget: raw });
                    }
                  }}
                  className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                  placeholder="500 000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Interní Plán
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatInputNumber(formData.planBudget)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\s/g, "");
                    if (/^\d*$/.test(raw)) {
                      setFormData({ ...formData, planBudget: raw });
                    }
                  }}
                  className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                  placeholder="450 000"
                />
              </div>
            </div>

            {/* Description */}
            {/* Description / Work Items */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Popis prací (položky pro šablonu)
                </label>
                <button
                  type="button"
                  onClick={addWorkItem}
                  className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    add
                  </span>
                  Přidat položku
                </button>
              </div>
              <div className="space-y-2">
                {formData.workItems.map((item, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <textarea
                      rows={1}
                      value={item}
                      onChange={(e) => {
                        updateWorkItem(index, e.target.value);
                        // Auto-grow
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                      }}
                      className="flex-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white resize-none overflow-hidden"
                      placeholder="Popis položky..."
                      style={{ minHeight: "38px" }}
                    />
                    <button
                      type="button"
                      onClick={() => removeWorkItem(index)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      title="Odstranit položku"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete
                      </span>
                    </button>
                  </div>
                ))}
                {formData.workItems.length === 0 && (
                  <div
                    onClick={addWorkItem}
                    className="text-center p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <p className="text-xs text-slate-400">
                      Zatím žádné položky. Klikněte pro přidání.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Deadline */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Termín poptávky
                </label>
                {/* Sync button: Load dates from linked VŘ plan */}
                {mode === "edit" && linkedTenderPlanDates && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        deadline: linkedTenderPlanDates.dateTo || prev.deadline,
                      }));
                    }}
                    className="text-[10px] font-medium text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1"
                    title="Načíst termín z propojeného Plánu VŘ"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      sync
                    </span>
                    Načíst z VŘ
                  </button>
                )}
              </div>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) =>
                  setFormData({ ...formData, deadline: e.target.value })
                }
                min={new Date().toISOString().split("T")[0]}
                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Termín pro podání cenové nabídky
              </p>
            </div>

            {/* Realization dates */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Termín realizace (nepovinné)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-slate-400 mb-1">Od</p>
                  <input
                    type="date"
                    value={formData.realizationStart}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        realizationStart: e.target.value,
                      })
                    }
                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 mb-1">Do</p>
                  <input
                    type="date"
                    value={formData.realizationEnd}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        realizationEnd: e.target.value,
                      })
                    }
                    min={formData.realizationStart || undefined}
                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Předpokládaný termín realizace prací
              </p>
            </div>

            {/* File upload - only for create mode */}
            {mode === "create" && (
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  Dokumenty
                </label>
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex flex-col items-center justify-center">
                      <span className="material-symbols-outlined text-slate-400 text-[28px] mb-1">
                        upload_file
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Klikněte pro výběr souborů
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        PDF, Word, Excel, obrázky (max 10MB)
                      </p>
                    </div>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xlsx,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                    />
                  </label>
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="material-symbols-outlined text-slate-400 text-[18px]">
                              description
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                {file.name}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="text-slate-400 hover:text-red-500 transition-colors ml-2"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              close
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-950/30 border-t border-slate-200 dark:border-slate-700/40 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && (
                <span className="material-symbols-outlined animate-spin text-[16px]">
                  progress_activity
                </span>
              )}
              {isSubmitting ? "Ukládání..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        variant={alertModal.variant}
      />
    </div>
  );
};
