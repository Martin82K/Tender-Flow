import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  onNavigateToPipeline?: (categoryId: string) => void;
  onCategoryNavigate?: (categoryId: string | null) => void;
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

  const allTabs = useMemo(
    () =>
      [
        { id: "overview", label: "Přehled", icon: "dashboard" },
        { id: "tender-plan", label: "Plán VŘ", icon: "calendar_today" },
        {
          id: "pipeline",
          label: "Výběrová řízení",
          icon: "account_tree",
          feature: FEATURES.MODULE_PIPELINE,
        },
        {
          id: "schedule",
          label: "Harmonogram",
          icon: "event_note",
          feature: FEATURES.PROJECT_SCHEDULE,
        },
        {
          id: "map",
          label: "Mapa",
          icon: "map",
          feature: FEATURES.MODULE_MAPS,
        },
        { id: "documents", label: "Dokumenty", icon: "folder_open" },
        {
          id: "contracts",
          label: "Smlouvy",
          icon: "description",
          feature: FEATURES.MODULE_CONTRACTS,
        },
        { id: "settings", label: "Nastavení", icon: "settings" },
      ] as const,
    [],
  );

  const visibleTabs = useMemo(
    () => allTabs.filter((tab) => !("feature" in tab) || hasFeature(tab.feature)),
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
    ? "select-no-native-arrow w-full bg-[#faf6ee] border border-[rgba(20,16,8,0.14)] text-[#14110a] px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider focus:ring-2 focus:ring-[#ff8a33]/20"
    : "select-no-native-arrow w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-primary/20";
  const desktopTabsClass = isIndustrialSkin
    ? "hidden min-w-max md:flex items-center gap-1.5 bg-transparent p-0 rounded-none border-0"
    : "hidden min-w-max md:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950/50 p-1 rounded-2xl border border-slate-200 dark:border-slate-800";

  const renderClassicTabs = () => (
    <div className="flex w-full items-center">
      <div className="relative w-full md:hidden">
        <select
          value={activeTab}
          onChange={(e) => onTabChange(e.target.value as ProjectTab)}
          className={mobileTabsClass}
        >
          {visibleTabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
        <span className={`material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-sm ${isIndustrialSkin ? "text-[#9c9684]" : "text-slate-400"}`}>expand_more</span>
      </div>

      <div data-help-id="project-tabs" className={desktopTabsClass}>
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id as ProjectTab)}
            data-active={activeTab === tab.id ? "true" : "false"}
            className={`flex items-center gap-2 px-3 lg:px-4 py-1.5 text-[11px] uppercase tracking-wider transition-all duration-200 ${isIndustrialSkin
              ? activeTab === tab.id
                ? "rounded-none border-b-2 border-[#ff8a33] text-[#b03a05] font-bold bg-transparent shadow-none ring-0"
                : "rounded-none border-b-2 border-transparent text-[#6e6757] font-bold hover:text-[#14110a] bg-transparent"
              : activeTab === tab.id
                ? "rounded-xl bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-black"
                : "rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white font-black"
              }`}
          >
            <span className={`material-symbols-outlined opacity-70 ${isIndustrialSkin ? "text-[15px]" : "text-[18px]"}`}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="tf-project-shell flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <Header
        title={project.title}
        subtitle={currentStatus}
        skin={skin}
        childrenBelow
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
      >
        {renderClassicTabs()}
      </Header>

      {isArchived && <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm font-medium text-amber-800">Archivovaná stavba je pouze ke čtení. Nevznikají zde nové úkoly, schválení ani oznámení; obnovit ji může systémový vlastník stavby.</div>}
      {!isArchived && isReadOnly && <div className="border-b border-blue-200 bg-blue-50 px-6 py-3 text-sm font-medium text-blue-800">K této stavbě máte přístup pouze pro čtení.</div>}
      <div className={`flex-1 overflow-auto flex flex-col ${isReadOnly && activeTab !== "settings" ? "pointer-events-none select-none opacity-80" : ""}`} aria-readonly={isReadOnly}>
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
            onOpenContract={onNavigateToContract}
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
        {activeTab === "documents" && (
          <ProjectDocuments
            project={project}
            onUpdate={onUpdateDetails}
            currentUserId={currentUserId}
            canDocHub={hasFeature(FEATURES.DOC_HUB)}
            canTemplates={
              hasFeature(FEATURES.DYNAMIC_TEMPLATES) ||
              hasFeature(FEATURES.DEMAND_GENERATION) ||
              hasFeature(FEATURES.LOSER_EMAIL)
            }
            autoShortenProjectDocs={currentUser?.preferences?.autoShortenProjectDocs ?? false}
          />
        )}
        {activeTab === "contracts" && (
          <ContractsModule
            projectId={projectId}
            projectDetails={project}
            onUpdateDetails={onUpdateDetails}
            initialContractId={initialContractId}
            contractsState={contractsState}
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
