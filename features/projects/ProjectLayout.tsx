import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { contractMutationsApi } from "@features/projects/contracts/api";
import { Header } from "@/shared/ui/Header";
import { NotificationBell } from "@features/notifications/ui/NotificationBell";
import { HelpButton } from "@features/help";
import { TaskCreateButton } from "@features/tasks";
import { Pipeline } from "@features/projects/pipeline/Pipeline";
import { TenderPlan } from "@/features/projects/ui/TenderPlan";
import { ProjectSchedule } from "@/features/projects/ui/ProjectSchedule";
import { ProjectOverviewNew } from "@/features/projects/ui/ProjectOverviewNew";
import type {
  ProjectTab,
  ProjectDetails,
  DemandCategory,
  Bid,
  Subcontractor,
  StatusConfig,
  ProjectAccessKind,
  ProjectTeamRole,
  User,
} from "@/types";
import { ProjectDocumentsWorkspace } from "@features/projects/documents/ui/ProjectDocumentsWorkspace";
import { ProjectDocuments } from "@features/projects/documents/ui/ProjectDocuments";
import { ContractsModule } from "@features/projects/contracts/ContractsModule";
import { useContractsWithDetails } from "@features/projects/contracts/hooks/useContractsWithDetails";
import { useFeatures } from "@/context/FeatureContext";
import { FEATURES } from "@/config/features";
import { ProjectMapView } from "@features/maps/components/ProjectMapView";
import { geocodingService } from "@features/maps/services/geocodingService";
import type { ThemeSkin } from "@/shared/types/theme";
import { ProjectTeamSettings } from "@features/projects/team/ProjectTeamSettings";
import { projectService } from "@/services/projectService";
import { ThemedNativeSelect } from "@shared/ui/ThemedNativeSelect";
import { PROJECT_NAVIGATION } from "@features/projects/model/projectNavigation";
import { ConstructionBudget } from "@features/projects/budget/ui/ConstructionBudget";
// --- Main Layout Component ---

interface ProjectLayoutProps {
  projectId: string;
  projectDetails?: ProjectDetails;
  onUpdateDetails: (updates: Partial<ProjectDetails>) => void;
  onAddCategory: (category: DemandCategory) => Promise<void>;
  onEditCategory?: (category: DemandCategory) => void | Promise<void>;
  onDeleteCategory?: (categoryId: string) => void;
  onBidsChange?: (projectId: string, bids: Record<string, Bid[]>) => void;
  activeTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
  contacts: Subcontractor[];
  statuses?: StatusConfig[];
  onAddContact: (contact: Subcontractor) => Promise<void> | void;
  onUpdateContact: (contact: Subcontractor) => Promise<void> | void;
  initialPipelineCategoryId?: string;
  onNavigateToPipeline?: (categoryId: string, bidId?: string) => void;
  onCategoryNavigate?: (categoryId: string | null, bidId?: string) => void;
  initialContractId?: string;
  onNavigateToContract?: (contractId: string) => void;
  skin?: ThemeSkin;
  currentUserId?: string;
  currentUser?: User | null;
}

export const ProjectLayout: React.FC<ProjectLayoutProps> = ({
  projectId,
  projectDetails,
  onUpdateDetails,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onBidsChange,
  activeTab,
  onTabChange,
  contacts,
  statuses,
  onAddContact,
  onUpdateContact,
  initialPipelineCategoryId,
  onNavigateToPipeline,
  onCategoryNavigate,
  initialContractId,
  onNavigateToContract,
  skin = "industrial",
  currentUserId,
  currentUser = null,
}) => {
  const project = projectDetails;
  const [searchQuery, setSearchQuery] = useState("");
  const [myProjectAccess, setMyProjectAccess] = useState<{
    accessKind: ProjectAccessKind;
    professionalRole: ProjectTeamRole | null;
    legacyPermission: "view" | "edit" | null;
  } | null>(null);
  const { hasFeature } = useFeatures();
  const contractsEnabled = hasFeature(FEATURES.MODULE_CONTRACTS);
  const contractsState = useContractsWithDetails(projectId, contractsEnabled);
  const geocodeAbortRef = useRef<{ cancelled: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    projectService.getMyProjectAccess()
      .then((roles) => { if (active) setMyProjectAccess(roles[projectId] ?? null); })
      .catch(() => { if (active) setMyProjectAccess(null); });
    return () => { active = false; };
  }, [projectId]);

  const handleAddressChanged = useCallback((address: string, location: string) => {
    // Cancel any in-flight geocoding request
    if (geocodeAbortRef.current) geocodeAbortRef.current.cancelled = true;
    const token = { cancelled: false };
    geocodeAbortRef.current = token;

    const detailsForGeocode = { ...project, address, location, latitude: undefined, longitude: undefined } as ProjectDetails;
    geocodingService.geocodeProject(detailsForGeocode).then(result => {
      if (token.cancelled) return; // Stale request — discard
      if (result) {
        onUpdateDetails({
          latitude: result.lat,
          longitude: result.lng,
          geocodedAt: new Date().toISOString(),
        });
      }
    });
  }, [project, onUpdateDetails]);

  const allTabs = PROJECT_NAVIGATION;

  const visibleTabs = useMemo(
    () => allTabs.filter((tab) => !tab.feature || hasFeature(tab.feature)),
    [allTabs, hasFeature],
  );

  useEffect(() => {
    const isAllowed = visibleTabs.some((tab) => tab.id === activeTab);
    if (!isAllowed) {
      const fallbackTab = visibleTabs[0]?.id || "overview";
      if (fallbackTab !== activeTab) {
        onTabChange(fallbackTab as ProjectTab);
      }
    }
  }, [activeTab, onTabChange, visibleTabs]);

  const handleLocalNavigateToPipeline = (categoryId: string) => {
    onTabChange("pipeline");
    onNavigateToPipeline?.(categoryId);
  };

  if (!project) return <div>Project not found</div>;

  const projectStatusLabel: Record<NonNullable<ProjectDetails["status"]>, string> = {
    tender: "V soutěži",
    realization: "V realizaci",
    archived: "Archiv",
  };
  const currentStatus = projectStatusLabel[project.status ?? "tender"];
  const isArchived = project.status === "archived";
  const isReadOnly = isArchived
    || myProjectAccess?.accessKind === "legacy_external"
    || myProjectAccess?.legacyPermission === "view";
  const isIndustrialSkin = skin === "industrial";
  const mobileTabsClass = isIndustrialSkin
    ? "w-full rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wider"
    : "w-full rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider";
  const renderClassicTabs = () => (
    <div className="w-full border-b border-slate-200 p-3 dark:border-slate-800 md:hidden">
      <ThemedNativeSelect aria-label="Navigace projektu" value={activeTab}
        onChange={event => onTabChange(event.target.value as ProjectTab)} className={mobileTabsClass}>
        {visibleTabs.map(tab => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
      </ThemedNativeSelect>
    </div>
  );

  return (
    <div className="tf-project-shell flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <Header
        title={project.title}
        subtitle={`${currentStatus} · ${visibleTabs.find(tab => tab.id === activeTab)?.label ?? "Přehled"}`}
        skin={skin}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Hledat v projektu..."
        helpSlot={
          <div className="flex items-center gap-1">
            {!isReadOnly && <TaskCreateButton
              projectId={projectId}
              className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200/60 bg-white/80 text-primary transition-all hover:bg-primary/10 dark:border-slate-700/60 dark:bg-slate-800/80"
            >
              <span className="sr-only">Úkol</span>
            </TaskCreateButton>}
            <HelpButton />
          </div>
        }
        notificationSlot={<NotificationBell />}
      />
      {renderClassicTabs()}

      {isArchived && <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm font-medium text-amber-800">Archivovaná stavba je pouze ke čtení. Nevznikají zde nové úkoly, schválení ani oznámení; obnovit ji může systémový vlastník stavby.</div>}
      {!isArchived && isReadOnly && <div className="border-b border-blue-200 bg-blue-50 px-6 py-3 text-sm font-medium text-blue-800">K této stavbě máte přístup pouze pro čtení.</div>}
      <div className={`flex-1 overflow-auto flex flex-col ${isReadOnly && activeTab !== "settings" && activeTab !== "documents" && activeTab !== "budget" ? "pointer-events-none select-none opacity-80" : ""}`} aria-readonly={isReadOnly}>
        {activeTab === "overview" && (
          <ProjectOverviewNew
            project={project}
            onUpdate={onUpdateDetails}
            onAddressChanged={handleAddressChanged}
            variant="compact"
            searchQuery={searchQuery}
            onNavigateToPipeline={handleLocalNavigateToPipeline}
            currentUserId={currentUserId}
            skin={skin}
          />
        )}
        {activeTab === "budget" && <ConstructionBudget searchQuery={searchQuery} onSearchChange={setSearchQuery} key={projectId} projectId={projectId} organizationId={project.organizationId} userId={currentUserId} categories={project.categories || []} readOnly={isReadOnly} />}
        {activeTab === "tender-plan" && (
          <TenderPlan
            projectId={projectId}
            categories={project.categories || []}
            onCreateCategory={async (name, dateFrom, dateTo) => {
              // Switch to pipeline tab and open add category modal
              onTabChange("pipeline");
              // Create the new category with VŘ dates
              const newCategory: DemandCategory = {
                id: `cat_${Date.now()}`,
                title: name,
                budget: "0 Kč",
                sodBudget: 0,
                planBudget: 0,
                status: "open",
                subcontractorCount: 0,
                description: "",
                deadline: dateTo || "", // VŘ dateTo → deadline (termín nabídky)
              };
              await onAddCategory(newCategory);
            }}
          />
        )}
        {activeTab === "pipeline" && (
          <Pipeline
            projectId={projectId}
            projectDetails={project}
            currentUser={currentUser}
            bids={project.bids || {}}
            contacts={contacts}
            statuses={statuses}
            onAddCategory={onAddCategory}
            onEditCategory={onEditCategory}
            onDeleteCategory={onDeleteCategory}
            onBidsChange={(bids) => onBidsChange?.(projectId, bids)}
            onAddContact={onAddContact}
            onUpdateContact={onUpdateContact}
            searchQuery={searchQuery}
            initialOpenCategoryId={initialPipelineCategoryId}
            onCategoryNavigate={onCategoryNavigate}
            contracts={contractsState.contracts}
            onOpenContract={contractsEnabled ? onNavigateToContract : undefined}
            onLinkContract={contractsEnabled && !isReadOnly ? async (contractId, bidId) => {
              await contractMutationsApi.linkContractToBid(projectId, contractId, bidId);
              await contractsState.refresh();
            } : undefined}
            contractsLoading={contractsState.loading}
            contractsError={contractsState.error}
          />
        )}
        {activeTab === "schedule" && (
          <div className="flex-1 min-h-0">
            <ProjectSchedule
              projectId={projectId}
              projectTitle={project.title}
              categories={project.categories || []}
            />
          </div>
        )}
        {activeTab === "map" && (
          <ProjectMapView
            projectId={projectId}
            projectDetails={project}
            contacts={contacts}
            statuses={statuses}
            onUpdateDetails={onUpdateDetails}
          />
        )}
        {activeTab === "documents" && <ProjectDocumentsWorkspace projectId={projectId} project={project} onUpdate={onUpdateDetails} currentUserId={currentUserId} contractsState={contractsState} contractsEnabled={contractsEnabled} readOnly={isReadOnly} canDocHub={hasFeature(FEATURES.DOC_HUB)} canTemplates={hasFeature(FEATURES.DYNAMIC_TEMPLATES)} />}
        {activeTab === "project-settings" && (
          <ProjectDocuments
            key={activeTab}
            section="settings"
            project={project}
            onUpdate={onUpdateDetails}
            currentUserId={currentUserId}
            canDocHub={hasFeature(FEATURES.DOC_HUB)}
            canTemplates={
              hasFeature(FEATURES.DYNAMIC_TEMPLATES) ||
              hasFeature(FEATURES.DEMAND_GENERATION) ||
              hasFeature(FEATURES.LOSER_EMAIL)
            }
          />
        )}
        {(activeTab === "contracts" || activeTab === "contracts-client") && (
          <ContractsModule
            key={activeTab}
            party={activeTab === "contracts-client" ? "client" : "supplier"}
            projectId={projectId}
            projectDetails={project}
            onUpdateDetails={onUpdateDetails}
            initialContractId={initialContractId}
            contractsState={contractsState}
            onOpenSourceBid={visibleTabs.some(tab => tab.id === "pipeline") ? onNavigateToPipeline : undefined}
          />
        )}
        {activeTab === "settings" && (
          <ProjectTeamSettings
            projectId={projectId}
            organizationId={project.organizationId}
            currentUserId={currentUserId}
            readOnly={isReadOnly}
          />
        )}
      </div>
    </div>
  );
};
