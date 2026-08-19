import React, { useState, useEffect } from "react";
import { Header } from "@shared/ui/Header";
import type {
  DemandCategory,
  Bid,
  Subcontractor,
  ProjectDetails,
  StatusConfig,
  ContractWithDetails,
  User,
} from "@/types";
import { resolveDocHubStructureV1 } from "@shared/dochub/docHub";
import platformAdapter from "@infra/platform/platformAdapter";
import { DEFAULT_STATUSES } from "@/config/constants";
import { APP_VERSION } from "@/config/version";
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
import { useProjectOrganizationName } from "@features/projects/pipeline/model/useProjectOrganizationName";
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
  EditBidModal,
  PipelineCategoryDocuments,
  PipelineCategorySummary,
  PipelineContactModals,
  PipelineDetailToolbar,
  PipelineKanbanBoard,
  PipelineOverview,
  usePipelineAlert,
  usePipelineConfirmation,
} from "@features/projects/pipeline";

interface PipelineProps {
  projectId: string;
  projectDetails: ProjectDetails;
  currentUser: User | null;
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
  currentUser: user,
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
  const { alertModalNode, showAlert } = usePipelineAlert();
  const { confirmationModalNode, requestConfirmation } =
    usePipelineConfirmation();

  const projectData = projectDetails;
  const projectOrganizationName = useProjectOrganizationName({
    projectOrganizationId: projectDetails.organizationId,
    activeOrganizationId: user?.organizationId,
    activeOrganizationName: user?.organizationName,
    currentUserId: user?.id,
  });
  const docHubRoot = useEffectiveProjectDocHubRoot(projectDetails, user?.id ?? null).trim();
  const isDocHubEnabled =
    !!projectDetails.docHubEnabled && docHubRoot.length > 0;
  const canOpenDocHub = canOpenProjectDocHub(projectDetails, docHubRoot);
  const docHubStructure = resolveDocHubStructureV1(
    projectDetails.docHubStructureV1 || undefined,
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
    userId: user?.id,
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

  const handleDeleteBidRequest = (bidId: string) => {
    requestConfirmation({
      title: "Odstranit nabídku",
      message:
        "Opravdu chcete odebrat tohoto dodavatele z výběrového řízení? Tato akce je nevratná.",
      onConfirm: () => handleDeleteBid(bidId),
    });
  };

  const handleDragStart = (e: React.DragEvent, bidId: string) => {
    e.dataTransfer.setData("bidId", bidId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (!onDeleteCategory) return;

    requestConfirmation({
      title: "Smazat poptávku",
      message: "Opravdu chcete smazat tuto poptávku? Tato akce je nevratná.",
      onConfirm: () => onDeleteCategory(categoryId),
    });
  };

  if (activeCategory) {
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

        <PipelineCategorySummary
          title={activeCategory.title}
          sodBudget={activeCategory.sodBudget}
          planBudget={activeCategory.planBudget}
        />

        <PipelineCategoryDocuments
          documents={activeCategory.documents || []}
          onOpenError={(message) =>
            showAlert({ title: "Chyba", message, variant: "danger" })
          }
        />

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

        <PipelineContactModals
          isSelectorOpen={isSubcontractorModalOpen}
          isSelectorMaximized={isSubcontractorModalMaximized}
          contacts={localContacts}
          selectorStatuses={DEFAULT_STATUSES}
          contactStatuses={externalStatuses}
          selectedIds={selectedSubcontractorIds}
          onSelectionChange={setSelectedSubcontractorIds}
          onToggleSelectorMaximize={() =>
            setIsSubcontractorModalMaximized(!isSubcontractorModalMaximized)
          }
          onCloseSelector={() => setIsSubcontractorModalOpen(false)}
          onConfirmSelection={() => handleAddSubcontractors(localContacts)}
          onAddContact={handleCreateContactRequest}
          onEditContact={setEditingContact}
          projectPosition={
            projectData.latitude != null && projectData.longitude != null
              ? { lat: projectData.latitude, lng: projectData.longitude }
              : null
          }
          isCreateContactOpen={isCreateContactModalOpen}
          newContactName={newContactName}
          editingContact={editingContact}
          existingSpecializations={Array.from(
            new Set(localContacts.flatMap((contact) => contact.specialization)),
          ).sort()}
          onCloseContact={closeContactModal}
          onSaveNewContact={handleSaveNewContact}
          onUpdateContact={handleUpdateContact}
        />

        {/* Edit Bid Modal */}
        {editingBid && (
          <EditBidModal
            bid={editingBid}
            onClose={() => setEditingBid(null)}
            onSave={handleSaveBid}
          />
        )}

        {confirmationModalNode}

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
        exportMeta={{
          organizationName: projectOrganizationName,
          projectTitle: projectDetails.title || "Projekt",
          projectStatus: projectDetails.status || "realization",
          exportedBy: user?.name?.trim() || "Uživatel",
          appVersion: APP_VERSION,
        }}
        onExportError={(message) => {
          showAlert({
            title: "Export se nezdařil",
            message,
            variant: "danger",
          });
        }}
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
      {confirmationModalNode}
    </div>
  );
};
