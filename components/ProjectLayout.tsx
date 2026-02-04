import React, { useEffect, useMemo, useState } from "react";
import { Header } from "./Header";
import { Pipeline } from "./Pipeline";
import { TenderPlan } from "./TenderPlan";
import { ProjectSchedule } from "./ProjectSchedule";
import {
  ProjectTab,
  ProjectDetails,
  DemandCategory,
  Bid,
  Subcontractor,
  StatusConfig,
} from "../types";
import { ProjectOverviewNew } from "./ProjectOverviewNew";
import { ProjectDocuments, Contracts } from "./projectLayoutComponents";
import { useFeatures } from "../context/FeatureContext";
import { FEATURES } from "../config/features";
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
}) => {
  const project = projectDetails;
  const [searchQuery, setSearchQuery] = useState("");
  const { hasFeature } = useFeatures();

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

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <Header
        title={project.title}
        subtitle="Detail stavby"
        onSearchChange={setSearchQuery}
        searchPlaceholder="Hledat v projektu..."
      >
        <div className="flex items-center gap-4">
          {/* Mobile dropdown tabs */}
          <div className="md:hidden relative min-w-[140px]">
            <select
              value={activeTab}
              onChange={(e) => onTabChange(e.target.value as ProjectTab)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tighter focus:ring-2 focus:ring-primary/20 appearance-none"
            >
              {visibleTabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">expand_more</span>
          </div>

          {/* Desktop horizontal tabs */}
          <div className="hidden md:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id as ProjectTab)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${activeTab === tab.id
                  ? 'bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                <span className="material-symbols-outlined text-[18px] opacity-70">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </Header>

      <div className="flex-1 overflow-auto flex flex-col">
        {activeTab === "overview" && (
          <ProjectOverviewNew
            project={project}
            onUpdate={onUpdateDetails}
            variant="compact"
            searchQuery={searchQuery}
            onNavigateToPipeline={handleLocalNavigateToPipeline}
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

              // Sync: Link the tender_plan to this new category
              try {
                const { supabase } = await import("../services/supabase");
                // Find the tender_plan by name and update its category_id
                const { error } = await supabase
                  .from("tender_plans")
                  .update({ category_id: newCategory.id })
                  .eq("project_id", projectId)
                  .eq("name", name);

                if (error) {
                  console.error(
                    "Error linking tender_plan to category:",
                    error,
                  );
                }
              } catch (err) {
                console.error("Error syncing tender_plan:", err);
              }
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
        {activeTab === "documents" && (
          <ProjectDocuments project={project} onUpdate={onUpdateDetails} />
        )}
        {activeTab === "contracts" && (
          <Contracts projectId={projectId} projectDetails={project} />
        )}
      </div>
    </div>
  );
};
