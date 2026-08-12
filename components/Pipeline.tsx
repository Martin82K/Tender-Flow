import React, { useState, useEffect } from "react";
import { Header } from "./Header";
import {
  DemandCategory,
  Bid,
  Subcontractor,
  ProjectDetails,
  StatusConfig,
  ContractWithDetails,
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
import { useEffectiveProjectDocHubRoot } from "@features/projects/dochub/model/personalRoot";
import { canOpenProjectDocHub } from "@shared/dochub/cloudConnection";
import {
  isValidEmailAddress,
  normalizeEmailAddress,
  selectBulkInquiryRecipients,
  selectLoserEmailRecipients,
  type PipelineBulkEmailKind,
} from "@/features/projects/model/pipelineEmailModel";
import { PipelineBulkEmailConfirmationModal } from "@/features/projects/ui/PipelineBulkEmailConfirmationModal";
import {
  CategoryFormModal,
  CategoryCard,
  CreateContactModal,
  EditBidModal,
  PipelineDetailToolbar,
  PipelineKanbanBoard,
  PipelineOverview,
  SubcontractorSelectorModal,
} from "@features/projects/pipeline";

// --- Components ---
// All reusable components are now imported from pipelineComponents

interface PipelineProps {
  projectId: string;
  projectDetails: ProjectDetails;
  bids: Record<string, Bid[]>;
  contacts: Subcontractor[];
  statuses?: StatusConfig[];
  onAddCategory?: (category: DemandCategory) => Promise<void>;
  onEditCategory?: (category: DemandCategory) => void | Promise<void>;
  onDeleteCategory?: (categoryId: string) => void;
  onBidsChange?: (bids: Record<string, Bid[]>) => void;
  onAddContact?: (contact: Subcontractor) => Promise<void> | void;
  onUpdateContact?: (contact: Subcontractor) => Promise<void> | void;
  searchQuery?: string;
  initialOpenCategoryId?: string;
  onCategoryNavigate?: (categoryId: string | null) => void;
  contracts?: ContractWithDetails[];
  onOpenContract?: (contractId: string) => void;
  contractsLoading?: boolean;
  contractsError?: string | null;
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
  onAddContact,
  onUpdateContact,
  searchQuery = "",
  initialOpenCategoryId,
  onCategoryNavigate,
  contracts = [],
  onOpenContract,
  contractsLoading = false,
  contractsError = null,
}) => {
  const { user } = useAuth();
  // ... (existing code omitted for brevity)

  // ... inside the render, look for EditBidModal ...

  const projectData = projectDetails;
  const docHubRoot = useEffectiveProjectDocHubRoot(projectDetails, user?.id ?? null).trim();
  const isDocHubEnabled =
    !!projectDetails.docHubEnabled && docHubRoot.length > 0;
  const canOpenDocHub = canOpenProjectDocHub(projectDetails, docHubRoot);
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
      variant={alertModal.variant === "danger" ? "error" : alertModal.variant}
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
    resolveDesktopTenderFolderPath,
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
    projectDataId: projectId,
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
    organizationId: user?.organizationId,
    projectDataId: projectId,
    showAlert,
    persistNewContact: onAddContact,
    persistContactUpdate: onUpdateContact,
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
    projectDataId: projectId,
    projectName: projectData.title,
    projectDataDocHubProviderLegacy: projectData.docHubProvider || undefined,
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
    resolveDesktopTenderFolderPath,
    showAlert,
  });
  const [bulkEmailKind, setBulkEmailKind] =
    useState<PipelineBulkEmailKind | null>(null);
  const [isBulkEmailSubmitting, setIsBulkEmailSubmitting] = useState(false);
  const {
    handleGenerateInquiry,
    handleGenerateMaterialInquiry,
    handleGenerateBulkInquiry,
    handleExport,
    handleEmailLosers,
  } = usePipelineCommunicationActions({
    activeCategory,
    bids,
    projectId,
    projectDetails,
    emailClientMode: user?.preferences?.emailClientMode,
    userRole: user?.role,
    currentUser: user,
    updateBidsInternal,
    showAlert,
    runDocHubFallbackForCategory,
    resolveDesktopTenderFolderPath,
  });

  const openBulkEmailConfirmation = (kind: PipelineBulkEmailKind) => {
    if (!activeCategory) return;

    const currentUserEmail = normalizeEmailAddress(user?.email || "");
    if (!isValidEmailAddress(currentUserEmail)) {
      showAlert({
        title: "Chybí email odesílatele",
        message:
          "Hromadný koncept nelze vytvořit, protože přihlášený uživatel nemá platný email.",
        variant: "danger",
      });
      return;
    }

    const categoryBids = bids[activeCategory.id] || [];
    const selection =
      kind === "losers"
        ? selectLoserEmailRecipients(categoryBids)
        : selectBulkInquiryRecipients(categoryBids);

    if (selection.candidateBids.length === 0) {
      showAlert({
        title:
          kind === "losers"
            ? "Žádní nevybraní účastníci"
            : "Žádní dodavatelé k oslovení",
        message:
          kind === "losers"
            ? "Nejsou žádní nevybraní účastníci s cenovou nabídkou."
            : "Ve sloupci Oslovení nejsou žádní dodavatelé.",
        variant: "info",
      });
      return;
    }

    if (selection.emails.length === 0) {
      showAlert({
        title: "Chybí platné emaily",
        message: "Žádný z vybraných dodavatelů nemá platnou emailovou adresu.",
        variant: "info",
      });
      return;
    }

    setBulkEmailKind(kind);
  };

  const confirmBulkEmail = async () => {
    if (!bulkEmailKind) return;

    setIsBulkEmailSubmitting(true);
    try {
      const wasCreated =
        bulkEmailKind === "losers"
          ? await handleEmailLosers()
          : await handleGenerateBulkInquiry(bulkEmailKind);
      if (wasCreated) {
        setBulkEmailKind(null);
      }
    } finally {
      setIsBulkEmailSubmitting(false);
    }
  };
  const { handleOpenSupplierDocHub, handleOpenTenderDocHub } =
    usePipelineDocHubActions({
      activeCategory,
      projectData,
      projectDetails,
      docHubRoot,
      docHubStructure,
      isDocHubEnabled: canOpenDocHub,
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
    const bulkInquirySelection = selectBulkInquiryRecipients(categoryBids);
    const loserEmailSelection = selectLoserEmailRecipients(categoryBids);
    const selectedBulkEmailSelection =
      bulkEmailKind === "losers"
        ? loserEmailSelection
        : bulkInquirySelection;
    const currentUserEmail = normalizeEmailAddress(user?.email || "");

    // --- DETAIL VIEW (PIPELINE) ---
    return (
      <div className="tf-pipeline-view flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {alertModalNode}
        <Header
          title={activeCategory.title}
          subtitle={`${projectData.title} > Průběh výběrového řízení`}
          showSearch={false}
          showAccountMenu={false}
        >
          <PipelineDetailToolbar
            categoryTitle={activeCategory.title}
            canOpenDocHub={canOpenDocHub}
            inquiryRecipientCount={bulkInquirySelection.emails.length}
            loserRecipientCount={loserEmailSelection.emails.length}
            onBack={() => {
              setActiveCategory(null);
              onCategoryNavigate?.(null);
            }}
            onAddSubcontractor={() => setIsSubcontractorModalOpen(true)}
            onSelectBulkEmail={openBulkEmailConfirmation}
            onOpenDocHub={handleOpenTenderDocHub}
            onExport={handleExport}
          />
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

        <PipelineKanbanBoard
          category={activeCategory}
          bids={categoryBids}
          canOpenDocHub={canOpenDocHub}
          contracts={contracts}
          contractsLoading={contractsLoading}
          contractsError={contractsError}
          onDrop={handleDrop}
          onDragStart={handleDragStart}
          onEditBid={setEditingBid}
          onDeleteBidRequest={handleDeleteBidRequest}
          onDeleteBid={handleDeleteBid}
          onGenerateInquiry={handleGenerateInquiry}
          onGenerateMaterialInquiry={handleGenerateMaterialInquiry}
          onOpenSupplierDocHub={handleOpenSupplierDocHub}
          onToggleContracted={handleToggleContracted}
          onOpenContract={onOpenContract}
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
          projectPosition={
            projectData.latitude != null && projectData.longitude != null
              ? { lat: projectData.latitude, lng: projectData.longitude }
              : null
          }
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

        <PipelineBulkEmailConfirmationModal
          isOpen={bulkEmailKind !== null}
          kind={bulkEmailKind || "inquiry"}
          userEmail={currentUserEmail}
          selection={selectedBulkEmailSelection}
          isSubmitting={isBulkEmailSubmitting}
          onConfirm={confirmBulkEmail}
          onCancel={() => setBulkEmailKind(null)}
        />
      </div>
    );
  }

  // --- LIST VIEW (OVERVIEW) ---
  return (
    <div className="tf-pipeline-view flex flex-col h-full bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen">
      {alertModalNode}
      <PipelineOverview
        currentUserId={user?.id ?? null}
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
        isDesktop={!!platformAdapter.isDesktop}
        isDocHubEnabled={isDocHubEnabled}
        resolveDesktopTenderFolderPath={resolveDesktopTenderFolderPath}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateCategoryFromModal}
      />

      {/* Edit Category Modal */}
      <CategoryFormModal
        isOpen={isEditModalOpen}
        mode="edit"
        initialData={editingCategory || undefined}
        linkedTenderPlanDates={linkedTenderPlanDates}
        isDesktop={!!platformAdapter.isDesktop}
        isDocHubEnabled={isDocHubEnabled}
        resolveDesktopTenderFolderPath={resolveDesktopTenderFolderPath}
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
