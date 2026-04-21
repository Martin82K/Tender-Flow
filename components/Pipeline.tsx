import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Header } from "./Header";
import {
  DemandCategory,
  Bid,
  BidStatus,
  Subcontractor,
  ProjectDetails,
  StatusConfig,
} from "../types";
import { SubcontractorSelector } from "./SubcontractorSelector";
import { ConfirmationModal } from "./ConfirmationModal";
import { AlertModal } from "./AlertModal";
import { formatFileSize, getDocumentUrl } from "../services/documentService";
import {
  formatMoney,
  formatInputNumber,
} from "../utils/formatters";
import { useAuth } from "../context/AuthContext";
import {
  resolveDocHubStructureV1,
} from "../utils/docHub";
import platformAdapter from "../services/platformAdapter";
import { DEFAULT_STATUSES } from "../config/constants";
import {
  buildBidComparisonSuppliers,
  getTemplateLinksForInquiryKindModel,
  type PipelineInquiryGenerationKind,
} from "@/features/projects/model/pipelineModel";
import { usePipelineBidsState } from "@/features/projects/model/usePipelineBidsState";
import { usePipelineCategoryNavigation } from "@/features/projects/model/usePipelineCategoryNavigation";
import { usePipelineDocHubFallback } from "@/features/projects/model/usePipelineDocHubFallback";
import { usePipelineCategoryForms } from "@/features/projects/model/usePipelineCategoryForms";
import { usePipelineContactsController } from "@/features/projects/model/usePipelineContactsController";
import { usePipelineSubcontractorSelection } from "@/features/projects/model/usePipelineSubcontractorSelection";
import { usePipelineBidActions } from "@/features/projects/model/usePipelineBidActions";
import { usePipelineCommunicationActions } from "@/features/projects/model/usePipelineCommunicationActions";
import { usePipelineDocHubActions } from "@/features/projects/model/usePipelineDocHubActions";
import {
  Column,
  BidCard,
  EditBidModal,
  CategoryCard,
  CreateContactModal,
  SubcontractorSelectorModal,
  PipelineOverview,
  BidComparisonPanel,
  CategoryFormModal,
} from "./pipelineComponents";

// --- Components ---
// All reusable components are now imported from pipelineComponents

interface PipelineProps {
  projectId: string;
  projectDetails: ProjectDetails;
  bids: Record<string, Bid[]>;
  contacts: Subcontractor[];
  statuses?: StatusConfig[];
  onAddCategory?: (category: DemandCategory) => void;
  onEditCategory?: (category: DemandCategory) => void;
  onDeleteCategory?: (categoryId: string) => void;
  onBidsChange?: (bids: Record<string, Bid[]>) => void;
  onUpdateContact?: (contact: Subcontractor) => void;
  searchQuery?: string;
  initialOpenCategoryId?: string;
  onCategoryNavigate?: (categoryId: string | null) => void;
}

type PipelineViewMode = "grid" | "table";
export type InquiryGenerationKind = PipelineInquiryGenerationKind;

export const getTemplateLinksForInquiryKind = (
  project: ProjectDetails,
  kind: InquiryGenerationKind,
): string[] => {
  return getTemplateLinksForInquiryKindModel(project, kind);
};

export const Pipeline: React.FC<PipelineProps> = ({
  projectId,
  projectDetails,
  bids: initialBids,
  contacts: externalContacts,
  statuses: externalStatuses = DEFAULT_STATUSES,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onBidsChange,
  onUpdateContact,
  searchQuery = "",
  initialOpenCategoryId,
  onCategoryNavigate,
}) => {
  const { user } = useAuth();
  // ... (existing code omitted for brevity)

  // ... inside the render, look for EditBidModal ...

  const projectData = projectDetails;
  const docHubRoot = projectDetails.docHubRootLink?.trim() || "";
  const isDocHubEnabled =
    !!projectDetails.docHubEnabled && docHubRoot.length > 0;
  const docHubStructure = resolveDocHubStructureV1(
    projectDetails.docHubStructureV1 || undefined,
  );

  const handleOpenDocument = async (
    event: React.MouseEvent<HTMLAnchorElement>,
    documentPath: string,
  ) => {
    event.preventDefault();
    try {
      const signedUrl = await getDocumentUrl(documentPath);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error opening document:", error);
      showAlert({
        title: "Chyba",
        message: "Dokument se nepodařilo otevřít. Zkuste to prosím znovu.",
        variant: "danger",
      });
    }
  };

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: "danger" | "info" | "success";
    copyableText?: string;
  }>({ isOpen: false, title: "", message: "", variant: "info" });

  const showAlert = (args: {
    title: string;
    message: string;
    variant?: "danger" | "info" | "success";
    copyableText?: string;
  }) => {
    setAlertModal({
      isOpen: true,
      title: args.title,
      message: args.message,
      variant: args.variant ?? "info",
      copyableText: args.copyableText,
    });
  };

  const alertModalNode = (
    <AlertModal
      isOpen={alertModal.isOpen}
      title={alertModal.title}
      message={alertModal.message}
      variant={alertModal.variant}
      copyableText={alertModal.copyableText}
      onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
    />
  );

  const [demandFilter, setDemandFilter] = useState<
    "all" | "open" | "closed" | "sod"
  >("all");
  const PIPELINE_VIEW_MODE_STORAGE_KEY = "tender_pipeline_view_mode";
  const [viewMode, setViewMode] = useState<PipelineViewMode>(() => {
    const stored = localStorage.getItem(PIPELINE_VIEW_MODE_STORAGE_KEY);
    return stored === "table" || stored === "grid" ? stored : "grid";
  });
  const { bids, updateBidsInternal } = usePipelineBidsState({
    initialBids,
    onBidsChange,
  });
  // const [contacts, setContacts] = useState<Subcontractor[]>(ALL_CONTACTS); // Use prop directly or state if we modify it locally?
  // The component modifies contacts (adding new ones). So we might need state, but initialized from prop.
  useEffect(() => {
    localStorage.setItem(PIPELINE_VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const {
    activeCategory,
    setActiveCategory,
    isBidComparisonPanelOpen,
    setIsBidComparisonPanelOpen,
    bidComparisonTenderPath,
    isResolvingBidComparisonPath,
    resolveDesktopTenderFolderPath,
    handleOpenBidComparisonPanel,
  } = usePipelineCategoryNavigation({
    projectId,
    initialOpenCategoryId,
    categories: projectDetails.categories,
    docHubRoot,
    docHubStructureV1: projectDetails.docHubStructureV1 || undefined,
  });

  const { runDocHubFallbackForCategory } = usePipelineDocHubFallback({
    projectId,
    projectData,
    projectDetails,
    bids,
    docHubRoot,
    isDocHubEnabled,
    docHubStructure,
    userRole: user?.role,
    activeCategoryId: activeCategory?.id ?? null,
  });

  const {
    isSubcontractorModalOpen,
    setIsSubcontractorModalOpen,
    isSubcontractorModalMaximized,
    setIsSubcontractorModalMaximized,
    selectedSubcontractorIds,
    setSelectedSubcontractorIds,
    handleAddSubcontractors,
  } = usePipelineSubcontractorSelection({
    activeCategory,
    bids,
    updateBidsInternal,
    userRole: user?.role,
    projectDataId: projectData.id,
    projectDataDocHubProvider: projectData.docHubProvider || undefined,
    projectDataDocHubStructureV1: projectData.docHubStructureV1 || undefined,
    isDocHubEnabled,
    docHubRoot,
    showAlert,
  });

  const {
    localContacts,
    isCreateContactModalOpen,
    newContactName,
    editingContact,
    setEditingContact,
    handleCreateContactRequest,
    closeContactModal,
    handleSaveNewContact,
    handleUpdateContact,
  } = usePipelineContactsController({
    externalContacts,
    userRole: user?.role,
    projectDataId: projectData.id,
    showAlert,
    onContactSaved: (contact) => {
      setSelectedSubcontractorIds((prev) => new Set(prev).add(contact.id));
    },
  });

  // Edit Bid State
  const [editingBid, setEditingBid] = useState<Bid | null>(null);
  const {
    handleDrop,
    handleToggleContracted,
    handleSaveBid,
    handleDeleteBid,
  } = usePipelineBidActions({
    activeCategory,
    bids,
    updateBidsInternal,
    userId: user?.id,
    userRole: user?.role,
    projectDataId: projectData.id,
    projectName: projectData.title,
    projectDataDocHubProviderLegacy: projectData.dochub_provider || undefined,
    projectDataDocHubStructureV1: projectData.docHubStructureV1 || undefined,
    isDocHubEnabled,
    docHubRoot,
    runDocHubFallbackForCategory,
    onCloseEditBid: () => setEditingBid(null),
  });

  const {
    isAddModalOpen,
    setIsAddModalOpen,
    isEditModalOpen,
    editingCategory,
    linkedTenderPlanDates,
    handleCreateCategoryFromModal,
    handleEditCategoryFromModal,
    handleEditCategoryClick,
    handleToggleCategoryComplete,
    closeEditCategoryModal,
  } = usePipelineCategoryForms({
    projectId,
    onAddCategory,
    onEditCategory,
    showAlert,
  });
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const {
    handleGenerateInquiry,
    handleGenerateMaterialInquiry,
    handleExport,
    handleEmailLosers,
  } = usePipelineCommunicationActions({
    activeCategory,
    bids,
    projectDetails,
    emailClientMode: user?.preferences?.emailClientMode,
    userRole: user?.role,
    currentUser: user,
    updateBidsInternal,
    setIsExportMenuOpen,
    showAlert,
    runDocHubFallbackForCategory,
  });
  const { handleOpenSupplierDocHub, handleOpenTenderDocHub } =
    usePipelineDocHubActions({
      activeCategory,
      projectData,
      projectDetails,
      docHubRoot,
      docHubStructure,
      isDocHubEnabled,
      showAlert,
      resolveDesktopTenderFolderPath,
    });

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const closeConfirmModal = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleDeleteBidRequest = (bidId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Odstranit nabídku",
      message:
        "Opravdu chcete odebrat tohoto dodavatele z výběrového řízení? Tato akce je nevratná.",
      onConfirm: () => {
        handleDeleteBid(bidId);
        closeConfirmModal();
      },
    });
  };

  const getBidsForColumn = (categoryId: string, status: BidStatus) => {
    return (bids[categoryId] || []).filter((bid) => bid.status === status);
  };

  const handleDragStart = (e: React.DragEvent, bidId: string) => {
    e.dataTransfer.setData("bidId", bidId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (!onDeleteCategory) return;

    setConfirmModal({
      isOpen: true,
      title: "Smazat poptávku",
      message: "Opravdu chcete smazat tuto poptávku? Tato akce je nevratná.",
      onConfirm: () => {
        onDeleteCategory(categoryId);
        closeConfirmModal();
      },
    });
  };

  if (activeCategory) {
    const isDesktopMode =
      platformAdapter.isDesktop;
    const categoryBids = bids[activeCategory.id] || [];
    const bidComparisonSuppliers = buildBidComparisonSuppliers(categoryBids);

    // --- DETAIL VIEW (PIPELINE) ---
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {alertModalNode}
        <Header
          title={activeCategory.title}
          subtitle={`${projectData.title} > Průběh výběrového řízení`}
          showSearch={false}
        >
          <button
            onClick={() => {
              setActiveCategory(null);
              onCategoryNavigate?.(null);
            }}
            className="mr-auto flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors px-2"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="text-sm font-medium">Zpět na přehled</span>
          </button>
          <button
            data-help-id="kanban-add-supplier"
            onClick={() => setIsSubcontractorModalOpen(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span>Přidat dodavatele</span>
          </button>

          {isDocHubEnabled && (
            <button
              onClick={() => void handleOpenTenderDocHub()}
              className="flex items-center gap-2 bg-violet-100 dark:bg-violet-900/30 hover:bg-violet-200 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              title={`Otevřít složku: ${activeCategory.title}`}
            >
              <span className="material-symbols-outlined text-[20px]">
                folder_open
              </span>
              <span>Otevřít složku</span>
            </button>
          )}

          {isDesktopMode && (
            <button
              onClick={() => void handleOpenBidComparisonPanel()}
              className="flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-60"
              disabled={isResolvingBidComparisonPath}
              title="Otevřít panel porovnání cenových nabídek"
            >
              <span className="material-symbols-outlined text-[20px]">
                table_chart
              </span>
              <span>
                {isResolvingBidComparisonPath
                  ? "Načítám složku..."
                  : "Porovnání nabídek"}
              </span>
            </button>
          )}

          {/* Export Button with Dropdown */}
          <div data-help-id="kanban-export" className="relative">
            <button
              ref={exportButtonRef}
              onClick={() => {
                if (!isExportMenuOpen && exportButtonRef.current) {
                  const rect = exportButtonRef.current.getBoundingClientRect();
                  setMenuPosition({
                    top: rect.bottom + 8,
                    left: rect.right - 224, // w-56 = 14rem = 224px
                  });
                }
                setIsExportMenuOpen(!isExportMenuOpen);
              }}
              className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                download
              </span>
              <span>Export</span>
              <span className="material-symbols-outlined text-[16px]">
                expand_more
              </span>
            </button>

            {isExportMenuOpen &&
              createPortal(
                <>
                  <div
                    className="fixed inset-0 z-[9998] bg-transparent"
                    onClick={() => setIsExportMenuOpen(false)}
                  />
                  <div
                    className="fixed w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-[9999]"
                    style={{
                      top: `${menuPosition.top}px`,
                      left: `${menuPosition.left}px`,
                    }}
                  >
                    <button
                      onClick={() => handleExport("xlsx")}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left border-b border-slate-100 dark:border-slate-700"
                    >
                      <span className="material-symbols-outlined text-green-600 text-[20px]">
                        table_chart
                      </span>
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          Excel
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          .xlsx formát
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExport("markdown")}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left border-b border-slate-100 dark:border-slate-700"
                    >
                      <span className="material-symbols-outlined text-blue-600 text-[20px]">
                        code
                      </span>
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          Markdown
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          .md formát
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExport("pdf")}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-red-600 text-[20px]">
                        picture_as_pdf
                      </span>
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          PDF
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          .pdf formát
                        </div>
                      </div>
                    </button>
                  </div>
                </>,
                document.body,
              )}
          </div>

          {/* Email Losers Button */}
          <button
            onClick={handleEmailLosers}
            className="flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            title="Odeslat email nevybraným účastníkům s cenou"
          >
            <span className="material-symbols-outlined text-[20px]">mail</span>
            <span>Email nevybraným</span>
          </button>
        </Header>

        <div className="px-6 pt-4">
          <div data-help-id="kanban-info-bar" className="overflow-x-auto">
            <div className="flex min-w-max items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-white">
                {activeCategory.title}
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="font-medium text-slate-500 dark:text-slate-400">
                Cena SOD:
              </span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {formatMoney(activeCategory.sodBudget ?? 0)}
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="font-medium text-slate-500 dark:text-slate-400">
                Interní plán:
              </span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {formatMoney(activeCategory.planBudget ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Document List Section */}
        {activeCategory.documents && activeCategory.documents.length > 0 && (
          <div className="px-6 pt-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 text-[20px]">
                  folder_open
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Přiložené dokumenty
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {activeCategory.documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    onClick={(event) => {
                      void handleOpenDocument(event, doc.url);
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
                  >
                    <span className="material-symbols-outlined text-slate-400 text-[20px]">
                      description
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-primary">
                        {doc.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {formatFileSize(doc.size)}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-primary text-[16px]">
                      download
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        <div data-help-id="pipeline-kanban" className="flex-1 overflow-x-auto overflow-y-hidden p-6">
          <div className="flex h-full space-x-4 min-w-max">
            {/* 1. Oslovení (Contacted) */}
            <Column
              data-help-id="kanban-col-contacted"
              title="Oslovení"
              status="contacted"
              color="slate"
              count={getBidsForColumn(activeCategory.id, "contacted").length}
              onDrop={handleDrop}
            >
              {getBidsForColumn(activeCategory.id, "contacted").map((bid, idx) => (
                <BidCard
                  key={bid.id}
                  bid={bid}
                  data-help-id={idx === 0 ? "kanban-bid-card" : undefined}
                  onDragStart={handleDragStart}
                  onDoubleClick={setEditingBid}
                  onEdit={setEditingBid}
                  onDelete={handleDeleteBidRequest}
                  onGenerateInquiry={handleGenerateInquiry}
                  onGenerateMaterialInquiry={handleGenerateMaterialInquiry}
                  onOpenDocHubFolder={
                    isDocHubEnabled ? handleOpenSupplierDocHub : undefined
                  }
                />
              ))}
              {getBidsForColumn(activeCategory.id, "contacted").length ===
                0 && (
                <div className="text-center p-4 text-slate-400 text-sm italic">
                  Žádní dodavatelé v této fázi
                </div>
              )}
            </Column>

            {/* 2. Odesláno (Sent) */}
            <Column
              title="Odesláno"
              status="sent"
              color="blue"
              count={getBidsForColumn(activeCategory.id, "sent").length}
              onDrop={handleDrop}
            >
              {getBidsForColumn(activeCategory.id, "sent").map((bid) => (
                <BidCard
                  key={bid.id}
                  bid={bid}
                  onDragStart={handleDragStart}
                  onDoubleClick={setEditingBid}
                  onEdit={setEditingBid}
                  onDelete={handleDeleteBidRequest}
                  onOpenDocHubFolder={
                    isDocHubEnabled ? handleOpenSupplierDocHub : undefined
                  }
                />
              ))}
              {getBidsForColumn(activeCategory.id, "sent").length === 0 && (
                <div className="text-center p-4 text-slate-400 text-sm italic">
                  Žádní dodavatelé v této fázi
                </div>
              )}
            </Column>

            {/* 3. Cenová nabídka (Offers) */}
            <Column
              data-help-id="kanban-col-offer"
              title="Cenová nabídka"
              status="offer"
              color="amber"
              count={getBidsForColumn(activeCategory.id, "offer").length}
              onDrop={handleDrop}
            >
              {getBidsForColumn(activeCategory.id, "offer").map((bid) => (
                <BidCard
                  key={bid.id}
                  bid={bid}
                  onDragStart={handleDragStart}
                  onDoubleClick={setEditingBid}
                  onEdit={setEditingBid}
                  onDelete={handleDeleteBidRequest}
                  onOpenDocHubFolder={
                    isDocHubEnabled ? handleOpenSupplierDocHub : undefined
                  }
                />
              ))}
            </Column>

            {/* 4. Užší výběr (Shortlist) */}
            <Column
              title="Užší výběr"
              status="shortlist"
              color="blue"
              count={getBidsForColumn(activeCategory.id, "shortlist").length}
              onDrop={handleDrop}
            >
              {getBidsForColumn(activeCategory.id, "shortlist").map((bid) => (
                <BidCard
                  key={bid.id}
                  bid={bid}
                  onDragStart={handleDragStart}
                  onDoubleClick={setEditingBid}
                  onEdit={setEditingBid}
                  onDelete={handleDeleteBidRequest}
                  onOpenDocHubFolder={
                    isDocHubEnabled ? handleOpenSupplierDocHub : undefined
                  }
                />
              ))}
            </Column>

            {/* 5. Jednání o SOD (Contract Negotiation) */}
            <Column
              data-help-id="kanban-col-sod"
              title="Jednání o SOD"
              status="sod"
              color="green"
              count={getBidsForColumn(activeCategory.id, "sod").length}
              onDrop={handleDrop}
            >
              {getBidsForColumn(activeCategory.id, "sod").map((bid) => (
                <div key={bid.id} className="relative">
                  {/* Trophy icon */}
                  <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 rounded-full p-1 z-10 shadow-sm pointer-events-none">
                    <span className="material-symbols-outlined text-[16px] block">
                      trophy
                    </span>
                  </div>
                  {/* Contract icon - clickable */}
                  <button
                    onClick={() => handleToggleContracted(bid)}
                    className={`absolute -top-2 right-6 rounded-full p-1 z-10 shadow-sm transition-all hover:scale-110 ${
                      bid.contracted
                        ? "bg-yellow-400 text-yellow-900 ring-2 ring-yellow-300 animate-pulse"
                        : "bg-slate-600 text-slate-300 hover:bg-slate-500"
                    }`}
                    title={
                      bid.contracted
                        ? "Zasmluvněno ✓"
                        : "Označit jako zasmluvněno"
                    }
                  >
                    <span className="material-symbols-outlined text-[16px] block">
                      {bid.contracted ? "task_alt" : "description"}
                    </span>
                  </button>
                  <BidCard
                    bid={bid}
                    onDragStart={handleDragStart}
                    onDoubleClick={setEditingBid}
                    onEdit={setEditingBid}
                    onDelete={handleDeleteBid}
                    onOpenDocHubFolder={
                      isDocHubEnabled ? handleOpenSupplierDocHub : undefined
                    }
                  />
                </div>
              ))}
            </Column>

            {/* 6. Zamítnuto (Rejected) */}
            <Column
              title="Zamítnuto / Odstoupili"
              status="rejected"
              color="red"
              onDrop={handleDrop}
            >
              {getBidsForColumn(activeCategory.id, "rejected").map((bid) => (
                <BidCard
                  key={bid.id}
                  bid={bid}
                  onDragStart={handleDragStart}
                  onDoubleClick={setEditingBid}
                  onEdit={setEditingBid}
                  onDelete={handleDeleteBid}
                  onOpenDocHubFolder={
                    isDocHubEnabled ? handleOpenSupplierDocHub : undefined
                  }
                />
              ))}
            </Column>
          </div>
        </div>

        <BidComparisonPanel
          isOpen={isBidComparisonPanelOpen}
          onClose={() => setIsBidComparisonPanelOpen(false)}
          projectId={projectData.id}
          categoryId={activeCategory.id}
          initialTenderFolderPath={bidComparisonTenderPath}
          supplierNames={bidComparisonSuppliers}
        />

        <SubcontractorSelectorModal
          isOpen={isSubcontractorModalOpen}
          isMaximized={isSubcontractorModalMaximized}
          contacts={localContacts}
          statuses={DEFAULT_STATUSES}
          selectedIds={selectedSubcontractorIds}
          onSelectionChange={setSelectedSubcontractorIds}
          onToggleMaximize={() =>
            setIsSubcontractorModalMaximized(!isSubcontractorModalMaximized)
          }
          onClose={() => setIsSubcontractorModalOpen(false)}
          onConfirm={() => handleAddSubcontractors(localContacts)}
          onAddContact={handleCreateContactRequest}
          onEditContact={setEditingContact}
        />
        {(isCreateContactModalOpen || editingContact) && (
          <CreateContactModal
            initialName={newContactName}
            initialData={editingContact || undefined}
            existingSpecializations={Array.from(
              new Set(localContacts.flatMap((c) => c.specialization)),
            ).sort()}
            statuses={externalStatuses}
            onClose={closeContactModal}
            onSave={editingContact ? handleUpdateContact : handleSaveNewContact}
          />
        )}

        {/* Edit Bid Modal */}
        {editingBid && (
          <EditBidModal
            bid={editingBid}
            onClose={() => setEditingBid(null)}
            onSave={handleSaveBid}
          />
        )}

        {/* Confirmation Modal - Shared */}
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={closeConfirmModal}
          confirmLabel="Odstranit"
          variant="danger"
        />
      </div>
    );
  }

  // --- LIST VIEW (OVERVIEW) ---
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen">
      {alertModalNode}
      <PipelineOverview
        categories={projectData.categories}
        bids={bids}
        searchQuery={searchQuery}
        demandFilter={demandFilter}
        viewMode={viewMode}
        onFilterChange={setDemandFilter}
        onViewModeChange={setViewMode}
        onCategoryClick={(category) => {
          setActiveCategory(category);
          onCategoryNavigate?.(category.id);
        }}
        onAddClick={() => setIsAddModalOpen(true)}
        onEditCategory={handleEditCategoryClick}
        onDeleteCategory={handleDeleteCategory}
        onToggleCategoryComplete={handleToggleCategoryComplete}
      />

      {/* Create Category Modal */}
      <CategoryFormModal
        isOpen={isAddModalOpen}
        mode="create"
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateCategoryFromModal}
      />

      {/* Edit Category Modal */}
      <CategoryFormModal
        isOpen={isEditModalOpen}
        mode="edit"
        initialData={editingCategory || undefined}
        existingDocuments={editingCategory?.documents}
        linkedTenderPlanDates={linkedTenderPlanDates}
        onClose={closeEditCategoryModal}
        onSubmit={handleEditCategoryFromModal}
      />
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
        confirmLabel="Odstranit"
        variant="danger"
      />
    </div>
  );
};
