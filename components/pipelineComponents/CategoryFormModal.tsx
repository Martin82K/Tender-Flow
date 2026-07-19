/**
 * CategoryFormModal Component
 * Unified modal for creating and editing demand categories.
 * Extracted from Pipeline.tsx for better modularity.
 */

import React, { useState, useEffect } from "react";
import { BudgetAttachment, DemandCategory } from "../../types";
import { formatDecimal, parseDecimal } from "../../utils/formatters";
import { formatFileSize } from "../../services/documentService";
import { AlertModal } from "../AlertModal";
import { NumericInput } from "@/shared/ui/NumericInput";
import { openInExplorer } from "@infra/files/fileSystemService";
import {
  selectBudgetAttachment,
  selectPendingBudgetAttachment,
} from "@/services/budgetAttachmentService";
import type { PendingBudgetAttachment } from "@/services/budgetAttachmentService";
import { isBudgetAttachmentOverEmailLimit } from "@/features/projects/model/budgetAttachmentModel";

type PlanInputMode = "amount" | "percent";

export interface CategoryFormData {
  title: string;
  sodBudget: string;
  planBudget: string;
  description: string;
  workItems: string[];
  budgetAttachment: BudgetAttachment | null;
  pendingBudgetAttachment: PendingBudgetAttachment | null;
  deadline: string;
  realizationStart: string;
  realizationEnd: string;
}

interface CategoryFormModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  initialData?: Partial<DemandCategory>;
  linkedTenderPlanDates?: { dateFrom: string; dateTo: string } | null; // Dates from linked VŘ plan
  isDesktop?: boolean;
  isDocHubEnabled?: boolean;
  resolveDesktopTenderFolderPath?: (categoryTitle: string) => Promise<string | null>;
  onClose: () => void;
  onSubmit: (formData: CategoryFormData) => Promise<void>;
}

const initialFormState: CategoryFormData = {
  title: "",
  sodBudget: "",
  planBudget: "",
  description: "",
  workItems: [],
  budgetAttachment: null,
  pendingBudgetAttachment: null,
  deadline: "",
  realizationStart: "",
  realizationEnd: "",
};

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  isOpen,
  mode,
  initialData,
  linkedTenderPlanDates,
  isDesktop = false,
  isDocHubEnabled = false,
  resolveDesktopTenderFolderPath,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<CategoryFormData>(initialFormState);
  const [planInputMode, setPlanInputMode] = useState<PlanInputMode>("amount");
  const [planPercentDraft, setPlanPercentDraft] = useState("");
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
  const displayedBudgetAttachment =
    formData.pendingBudgetAttachment || formData.budgetAttachment;
  const budgetAttachmentExceedsEmailLimit =
    !!displayedBudgetAttachment &&
    isBudgetAttachmentOverEmailLimit(displayedBudgetAttachment);

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
        budgetAttachment: initialData.budgetAttachment || null,
        pendingBudgetAttachment: null,
        deadline: initialData.deadline || "",
        realizationStart: initialData.realizationStart || "",
        realizationEnd: initialData.realizationEnd || "",
      });
    } else if (isOpen) {
      setFormData(initialFormState);
    }
    setPlanInputMode("amount");
    setPlanPercentDraft("");
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
      await onSubmit(submissionData);
    } finally {
      setIsSubmitting(false);
    }
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

  const getFormNumber = (value: string): number | null => parseDecimal(value);

  const calculatePlanBudgetFromPercent = (
    sodBudget: number | null,
    discountPercent: number | null,
  ): number | null => {
    if (sodBudget === null || discountPercent === null) return null;
    const clampedPercent = Math.min(100, Math.max(0, discountPercent));
    return Math.max(0, sodBudget * (1 - clampedPercent / 100));
  };

  const updateSodBudget = (value: number | null) => {
    setFormData((prev) => ({
      ...prev,
      sodBudget: value === null ? "" : value.toString(),
      planBudget:
        planInputMode === "percent"
          ? calculatePlanBudgetFromPercent(value, parseDecimal(planPercentDraft))?.toString() || ""
          : prev.planBudget,
    }));
  };

  const updatePlanAmount = (value: number | null) => {
    setFormData((prev) => ({
      ...prev,
      planBudget: value === null ? "" : value.toString(),
    }));
  };

  const updatePlanPercent = (value: number | null) => {
    const clampedPercent = value === null ? null : Math.min(100, Math.max(0, value));
    setPlanPercentDraft(clampedPercent === null ? "" : clampedPercent.toString());
    setFormData((prev) => ({
      ...prev,
      planBudget:
        calculatePlanBudgetFromPercent(parseDecimal(prev.sodBudget), clampedPercent)?.toString() ||
        "",
    }));
  };

  const switchPlanInputMode = (nextMode: PlanInputMode) => {
    setPlanInputMode(nextMode);
    if (nextMode === "amount") return;

    const sodBudget = parseDecimal(formData.sodBudget);
    const planBudget = parseDecimal(formData.planBudget);
    if (!sodBudget || planBudget === null) {
      setPlanPercentDraft("");
      return;
    }

    const inferredPercent = Math.min(
      100,
      Math.max(0, (1 - planBudget / sodBudget) * 100),
    );
    setPlanPercentDraft(inferredPercent.toString());
    setFormData((prev) => ({
      ...prev,
      planBudget:
        calculatePlanBudgetFromPercent(sodBudget, inferredPercent)?.toString() || "",
    }));
  };

  const planBudgetPreview = getFormNumber(formData.planBudget);

  const resolveTenderFolder = async (): Promise<string | null> => {
    const categoryTitle = formData.title.trim();
    if (!categoryTitle) {
      setAlertModal({
        isOpen: true,
        title: "Chybí název VŘ",
        message: "Nejdříve vyplňte název sekce/VŘ, aby bylo možné najít odpovídající složku.",
        variant: "info",
      });
      return null;
    }

    if (!isDesktop) {
      setAlertModal({
        isOpen: true,
        title: "Desktop funkce",
        message:
          "Mapování lokální rozpočtové přílohy je dostupné pouze v desktop aplikaci. Webový režim nemůže automaticky číst soubory z disku.",
        variant: "info",
      });
      return null;
    }

    if (!isDocHubEnabled || !resolveDesktopTenderFolderPath) {
      setAlertModal({
        isOpen: true,
        title: "DocHub není připojen",
        message:
          "Nejdříve připojte kořenovou složku DocHubu v záložce Dokumenty.",
        variant: "danger",
      });
      return null;
    }

    const tenderFolder = await resolveDesktopTenderFolderPath(categoryTitle);
    if (!tenderFolder) {
      setAlertModal({
        isOpen: true,
        title: "Složka VŘ nenalezena",
        message: "Nepodařilo se dopočítat složku pro toto VŘ.",
        variant: "danger",
      });
      return null;
    }

    return tenderFolder;
  };

  const handleSelectBudgetAttachment = async () => {
    try {
      if (!isDesktop) {
        setAlertModal({
          isOpen: true,
          title: "Desktop funkce",
          message:
            "Mapování lokální rozpočtové přílohy je dostupné pouze v desktop aplikaci. Webový režim nemůže automaticky číst soubory z disku.",
          variant: "info",
        });
        return;
      }
      if (!isDocHubEnabled) {
        setAlertModal({
          isOpen: true,
          title: "DocHub není připojen",
          message: "Nejdříve připojte kořenovou složku DocHubu v záložce Dokumenty.",
          variant: "danger",
        });
        return;
      }

      if (mode === "create") {
        const pendingAttachment = await selectPendingBudgetAttachment();
        if (!pendingAttachment) return;
        setFormData((prev) => ({
          ...prev,
          budgetAttachment: null,
          pendingBudgetAttachment: pendingAttachment,
        }));
        return;
      }

      const tenderFolder = await resolveTenderFolder();
      if (!tenderFolder) return;

      const attachment = await selectBudgetAttachment(tenderFolder);
      if (!attachment) return;

      setFormData((prev) => ({
        ...prev,
        budgetAttachment: attachment,
        pendingBudgetAttachment: null,
      }));
    } catch (error) {
      setAlertModal({
        isOpen: true,
        title: "Přílohu nelze připojit",
        message: error instanceof Error ? error.message : "Výběr přílohy selhal.",
        variant: "danger",
      });
    }
  };

  const handleOpenTenderFolder = async () => {
    try {
      const tenderFolder = await resolveTenderFolder();
      if (!tenderFolder) return;
      const result = await openInExplorer(tenderFolder);
      if (!result.success) {
        throw new Error(result.error || "Složku se nepodařilo otevřít.");
      }
    } catch (error) {
      setAlertModal({
        isOpen: true,
        title: "Složku nelze otevřít",
        message: error instanceof Error ? error.message : "Otevření složky selhalo.",
        variant: "danger",
      });
    }
  };

  const handleDetachBudgetAttachment = () => {
    setFormData((prev) => ({
      ...prev,
      budgetAttachment: null,
      pendingBudgetAttachment: null,
    }));
  };

  if (!isOpen) return null;

  const title =
    mode === "create" ? "Nová Poptávka / Sekce" : "Upravit Poptávku";
  const submitLabel = mode === "create" ? "Vytvořit poptávku" : "Uložit změny";

  return (
    <div data-help-id="pipeline-category-form-modal" className="tf-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="tf-modal-panel tf-pipeline-modal-panel bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700/50 flex flex-col max-h-[90vh]">
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
                <NumericInput
                  value={getFormNumber(formData.sodBudget)}
                  onChange={updateSodBudget}
                  allowNegative={false}
                  className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                  placeholder="500 000,00"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Interní Plán
                  </label>
                  <div className="inline-flex rounded-md border border-slate-300 bg-slate-100 p-0.5 text-[10px] font-bold dark:border-slate-700 dark:bg-slate-800/70">
                    <button
                      type="button"
                      onClick={() => switchPlanInputMode("amount")}
                      className={`rounded px-2 py-0.5 transition-colors ${
                        planInputMode === "amount"
                          ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                      }`}
                    >
                      Kč
                    </button>
                    <button
                      type="button"
                      onClick={() => switchPlanInputMode("percent")}
                      className={`rounded px-2 py-0.5 transition-colors ${
                        planInputMode === "percent"
                          ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                      }`}
                    >
                      %
                    </button>
                  </div>
                </div>
                {planInputMode === "amount" ? (
                  <NumericInput
                    value={getFormNumber(formData.planBudget)}
                    onChange={updatePlanAmount}
                    allowNegative={false}
                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                    placeholder="450 000,00"
                  />
                ) : (
                  <>
                    <NumericInput
                      value={getFormNumber(planPercentDraft)}
                      onChange={updatePlanPercent}
                      allowNegative={false}
                      suffix="%"
                      className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                      placeholder="5,00"
                    />
                    <p className="mt-1 text-[10px] text-slate-400">
                      Interní plán:{" "}
                      {planBudgetPreview === null
                        ? "-"
                        : `${formatDecimal(planBudgetPreview)} Kč`}
                    </p>
                  </>
                )}
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

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                Rozpočtová příloha
              </label>
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 p-3">
                {displayedBudgetAttachment ? (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="material-symbols-outlined text-slate-400 text-[20px]">
                        attach_file
                      </span>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                            {displayedBudgetAttachment.fileName}
                          </p>
                          {budgetAttachmentExceedsEmailLimit && (
                            <span
                              role="img"
                              aria-label="Příloha je větší než 10 MB a do EML se nevloží"
                              title="Příloha je větší než 10 MB a do EML se nevloží. EML zpráva se vytvoří bez ní."
                              className="material-symbols-outlined shrink-0 text-[18px] text-amber-500"
                            >
                              error
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[10px] text-slate-400">
                          {formData.pendingBudgetAttachment
                            ? "Soubor bude zkopírován při vytvoření VŘ"
                            : formData.budgetAttachment?.relativePath}
                        </p>
                        {typeof displayedBudgetAttachment.size === "number" && (
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {formatFileSize(displayedBudgetAttachment.size)}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDetachBudgetAttachment}
                      className="shrink-0 text-slate-400 hover:text-red-500 transition-colors"
                      title="Odpojit přílohu"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        close
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="material-symbols-outlined text-[20px] text-slate-400">
                      attach_file
                    </span>
                    <span>
                      Není připojena žádná rozpočtová příloha pro e-mail poptávky.
                    </span>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSelectBudgetAttachment}
                    className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      upload_file
                    </span>
                    {displayedBudgetAttachment ? "Nahradit přílohu" : "Vybrat soubor"}
                  </button>
                  {mode === "edit" ? (
                    <button
                      type="button"
                      onClick={handleOpenTenderFolder}
                      className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        folder_open
                      </span>
                      Otevřít složku VŘ
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 text-[10px] text-slate-400">
                  Obsah souboru se neukládá do Tender Flow. Ukládá se jen propojení na soubor ve složce VŘ.
                </p>
              </div>
            </div>
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
        variant={alertModal.variant === "danger" ? "error" : alertModal.variant}
      />
    </div>
  );
};
