import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/shared/ui/Header";
import { NotificationBell } from "@features/notifications/ui/NotificationBell";
import { HelpButton } from "@features/help";
import { TaskCreateButton } from "@features/tasks";
import { Pipeline } from "@/shared/ui/projects/Pipeline";
import { TenderPlan } from "@/features/projects/ui/TenderPlan";
import { ProjectSchedule } from "@/features/projects/ui/ProjectSchedule";
import { ProjectOverviewNew } from "@/features/projects/ui/ProjectOverviewNew";
import {
  ProjectTab,
  ProjectDetails,
  DemandCategory,
  Bid,
  Subcontractor,
  StatusConfig,
} from "@/types";
import { ProjectDocuments } from "@/shared/ui/projects/ProjectDocuments";
import { ContractsModule } from "@features/projects/contracts/ContractsModule";
import { useFeatures } from "@/context/FeatureContext";
import { FEATURES } from "@/config/features";
import { ProjectMapView } from "@features/maps/components/ProjectMapView";
import { geocodingService } from "@features/maps/services/geocodingService";
import type { ThemeSkin } from "@/hooks/useTheme";
// --- Main Layout Component ---

interface ProjectLayoutProps {
  projectId: string;
  projectDetails?: ProjectDetails;
  onUpdateDetails: (updates: Partial<ProjectDetails>) => void;
  onAddCategory: (category: DemandCategory) => void;
  onEditCategory?: (category: DemandCategory) => void;
  onDeleteCategory?: (categoryId: string) => void;
  onBidsChange?: (projectId: string, bids: Record<string, Bid[]>) => void;
  activeTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
  contacts: Subcontractor[];
  statuses?: StatusConfig[];
  onUpdateContact: (contact: Subcontractor) => void;
  initialPipelineCategoryId?: string;
  onNavigateToPipeline?: (categoryId: string) => void;
  onCategoryNavigate?: (categoryId: string | null) => void;
  skin?: ThemeSkin;
  currentUserId?: string;
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
  onUpdateContact,
  initialPipelineCategoryId,
  onNavigateToPipeline,
  onCategoryNavigate,
  skin = "industrial",
  currentUserId,
}) => {
  const project = projectDetails;
  const [searchQuery, setSearchQuery] = useState("");
  const { hasFeature } = useFeatures();
  const geocodeAbortRef = useRef<{ cancelled: boolean } | null>(null);

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
      ] as const,
    [],
  );

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
            <span className="material-symbols-outlined text-[18px] opacity-70">{tab.icon}</span>
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
            <TaskCreateButton
              projectId={projectId}
              className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200/60 bg-white/80 text-primary transition-all hover:bg-primary/10 dark:border-slate-700/60 dark:bg-slate-800/80"
            >
              <span className="sr-only">Úkol</span>
            </TaskCreateButton>
            <HelpButton />
          </div>
        }
        notificationSlot={<NotificationBell />}
      >
        {renderClassicTabs()}
      </Header>

      <div className="flex-1 overflow-auto flex flex-col">
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
              onAddCategory(newCategory);
            }}
          />
        )}
        {activeTab === "pipeline" && (
          <Pipeline
            projectId={projectId}
            projectDetails={project}
            bids={project.bids || {}}
            contacts={contacts}
            statuses={statuses}
            onAddCategory={onAddCategory}
            onEditCategory={onEditCategory}
            onDeleteCategory={onDeleteCategory}
            onBidsChange={(bids) => onBidsChange?.(projectId, bids)}
            onUpdateContact={onUpdateContact}
            searchQuery={searchQuery}
            initialOpenCategoryId={initialPipelineCategoryId}
            onCategoryNavigate={onCategoryNavigate}
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
          <ProjectDocuments project={project} onUpdate={onUpdateDetails} />
        )}
        {activeTab === "contracts" && (
          <ContractsModule
            projectId={projectId}
            projectDetails={project}
            onUpdateDetails={onUpdateDetails}
          />
        )}
      </div>
    </div>
  );
};
