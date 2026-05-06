import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { View, Project, ProjectTab } from "../types";
import logo from "../assets/logo.svg";
import { SIDEBAR_NAVIGATION } from "../config/navigation";
import { FEATURES, type FeatureKey } from "../config/features";
import { useFeatures } from "../context/FeatureContext";
import { useLocation } from "@/shared/routing/router";
import type { ThemeSkin } from "@/hooks/useTheme";

import { APP_VERSION } from "../config/version";
const PROJECT_TABS: {
  id: ProjectTab;
  label: string;
  icon: string;
  feature?: FeatureKey;
}[] = [
  { id: "overview", label: "Přehled", icon: "dashboard" },
  { id: "tender-plan", label: "Plán VŘ", icon: "assignment" },
  {
    id: "pipeline",
    label: "Výběrová řízení",
    icon: "view_kanban",
    feature: FEATURES.MODULE_PIPELINE,
  },
  {
    id: "schedule",
    label: "Harmonogram",
    icon: "calendar_month",
    feature: FEATURES.PROJECT_SCHEDULE,
  },
  { id: "documents", label: "Dokumenty", icon: "folder" },
  {
    id: "contracts",
    label: "Smlouvy",
    icon: "description",
    feature: FEATURES.MODULE_CONTRACTS,
  },
];

interface SidebarProps {
  currentView: View;
  onViewChange: (
    view: View,
    opts?: {
      settingsTab?: "user" | "admin";
      settingsSubTab?:
        | "profile"
        | "contacts"
        | "excelUnlocker"
        | "excelMerger"
        | "urlShortener"
        | "registration"
        | "users"
        | "subscriptions"
        | "ai"
        | "tools";
    },
  ) => void;
  selectedProjectId: string;
  onProjectSelect: (id: string, tab?: string) => void;
  projects: Project[];
  isOpen: boolean;
  onToggle: () => void;
  skin?: ThemeSkin;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  selectedProjectId,
  onProjectSelect,
  projects,
  isOpen,
  onToggle,
  skin = "classic",
}) => {
  const { user } = useAuth();
  const { hasFeature } = useFeatures(); // Use feature context
  const { search } = useLocation();
  const [width, setWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Helper to close sidebar on mobile after navigation
  const closeMobileMenu = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768 && isOpen) {
      onToggle();
    }
  };

  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >({});

  type Tier = "free" | "starter" | "pro" | "enterprise" | "admin";
  const subscriptionTier = (user?.subscriptionTier || "free") as Tier;
  const isIndustrialSkin = skin === "industrial";
  const editionTextClassMap: Record<Tier, string> = {
    free: "text-slate-400",
    starter: "text-sky-400",
    pro: "text-indigo-400",
    enterprise: "text-amber-400",
    admin: "text-amber-400",
  };
  const activeNavClass = isIndustrialSkin
    ? "text-[#b03a05] font-semibold"
    : "text-primary font-semibold";
  const inactiveNavClass = isIndustrialSkin
    ? "text-[#6e6757] hover:bg-[#ff8a33]/10 hover:text-[#14110a]"
    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white";
  const activeIconClass = isIndustrialSkin
    ? "fill text-[#b03a05]"
    : "fill text-primary";
  const inactiveIconClass = isIndustrialSkin
    ? "text-[#9c9684] group-hover:text-[#14110a]"
    : "text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-100";
  const sidebarClass = isIndustrialSkin
    ? "tf-sidebar relative flex h-full flex-col bg-[#e6e0d2] border-r border-[rgba(20,16,8,0.10)] text-[#14110a] flex-shrink-0 z-20 select-none group/sidebar transition-all duration-300 ease-in-out max-md:fixed max-md:inset-0 max-md:z-50 max-md:!w-full max-md:h-[100dvh] max-md:max-h-[100dvh]"
    : "tf-sidebar relative flex h-full flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-shrink-0 z-20 select-none group/sidebar transition-all duration-300 ease-in-out max-md:fixed max-md:inset-0 max-md:z-50 max-md:!w-full max-md:h-[100dvh] max-md:max-h-[100dvh]";
  const selectedProjectOverlayClass = isIndustrialSkin
    ? "absolute inset-y-1 left-0 w-0.5 bg-[#ff8a33]"
    : "absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl border-l-2 border-primary";
  const toggleProjectExpand = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const settingsRoute = (() => {
    const params = new URLSearchParams(search);
    const tabParam = params.get("tab");
    const subTabParam = params.get("subTab");
    const tab =
      tabParam === "admin" || tabParam === "user" || tabParam === "tools" || tabParam === "organization"
        ? tabParam
        : null;
    const rawSubTab =
      subTabParam === "profile" ||
      subTabParam === "notifications" ||
      subTabParam === "backup" ||
      subTabParam === "contacts" ||
      subTabParam === "excelUnlocker" ||
      subTabParam === "excelMerger" ||
      subTabParam === "excelIndexer" ||
      subTabParam === "urlShortener" ||
      subTabParam === "registration" ||
      subTabParam === "users" ||
      subTabParam === "subscriptions" ||
      subTabParam === "ai" ||
      subTabParam === "tools" // legacy
        ? subTabParam
        : null;
    const subTab = rawSubTab === "tools" ? "excelUnlocker" : rawSubTab;
    return { tab, subTab: subTab as typeof rawSubTab };
  })();

  const isNavItemEnabled = useCallback(
    (item: any) => {
      if (item.feature && !hasFeature(item.feature)) return false;
      return true;
    },
    [hasFeature],
  );

  const isNavItemActive = useCallback(
    (item: any): boolean => {
      if (item.type === "group") {
        return (
          Array.isArray(item.children) &&
          item.children.some(
            (child: any) => isNavItemEnabled(child) && isNavItemActive(child),
          )
        );
      }

      if (item.view !== currentView) return false;
      if (item.view !== "settings") return true;

      const matchTab = item.settingsTab
        ? settingsRoute.tab === item.settingsTab
        : true;
      if (item.settingsSubTab)
        return matchTab && settingsRoute.subTab === item.settingsSubTab;

      return (
        settingsRoute.subTab === null || settingsRoute.subTab === "profile"
      );
    },
    [currentView, isNavItemEnabled, settingsRoute.subTab, settingsRoute.tab],
  );

  // Note: Removed auto-open effect for tools group to allow manual close behavior

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = mouseMoveEvent.clientX;
        // Min width 200px, Max width 480px
        if (newWidth >= 200 && newWidth <= 480) {
          setWidth(newWidth);
        }
      }
    },
    [isResizing],
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // Drag & Drop State for Projects (Read-only here)
  const [projectOrder, setProjectOrder] = useState<string[]>([]);

  // Load order from localStorage on mount
  useEffect(() => {
    const savedOrder = localStorage.getItem("projectOrder");
    if (savedOrder) {
      try {
        setProjectOrder(JSON.parse(savedOrder));
      } catch {
        setProjectOrder([]);
      }
    }
  }, []);

  // Get ordered projects (only non-archived)
  const activeProjects = projects.filter((p) => p.status !== "archived");
  const orderedProjects = [...activeProjects].sort((a, b) => {
    const aIndex = projectOrder.indexOf(a.id);
    const bIndex = projectOrder.indexOf(b.id);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  // Helper to render nav items
  const renderNavItem = (item: any, parentId?: string) => {
    if (!isNavItemEnabled(item)) {
      return null;
    }

    const isItemActive = isNavItemActive(item);

    // Special case for projects group which acts as accordion
    if (item.id === "projects") {
      return (
        <details key={item.id} className="group" open>
          <summary
            className={`flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg transition-all cursor-pointer list-none ${
              currentView === "project"
                ? activeNavClass
                : inactiveNavClass
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`material-symbols-outlined shrink-0 ${
                  currentView === "project" ? activeIconClass : ""
                }`}
              >
                {item.icon}
              </span>
              <p className="text-[13px] leading-normal break-words">{item.label}</p>
            </div>
            <span className="material-symbols-outlined text-[20px] transition-transform group-open:rotate-180 shrink-0">
              expand_more
            </span>
          </summary>

          <div className="flex flex-col mt-1 ml-2 gap-1">
            {/* Tlačítko Nová stavba */}
            <button
              onClick={() => {
                onViewChange("project-management");
                closeMobileMenu();
              }}
              className={isIndustrialSkin
                ? "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-all text-[#b03a05] hover:bg-[#ff8a33]/10 border border-dashed border-[#ff8a33]/40 hover:border-[#ff8a33]/70"
                : "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all text-primary hover:bg-primary/10 border border-dashed border-primary/30 hover:border-primary/50"}
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Nová stavba</span>
            </button>

            {orderedProjects.length === 0 && (
              <div className="px-4 py-2 text-xs text-slate-500 italic">
                Žádné aktivní stavby
              </div>
            )}
            {orderedProjects.map((project) => {
              const isExpanded = expandedProjects[project.id];
              const isSelected =
                currentView === "project" && selectedProjectId === project.id;

              return (
                <div key={project.id} className="flex flex-col">
                  {/* Project Header Item */}
                  <div
                    onClick={() => {
                      onProjectSelect(project.id, "overview");
                      closeMobileMenu();
                    }}
                    className={`flex items-center gap-2.5 text-left text-[13px] px-2.5 py-2 rounded-lg transition-all relative overflow-hidden cursor-pointer group/item ${
                      isSelected
                        ? isIndustrialSkin
                          ? "text-[#14110a] font-semibold bg-[#faf6ee]/55 rounded-md"
                          : "text-slate-900 dark:text-white font-semibold"
                        : isIndustrialSkin
                          ? "text-[#6e6757] hover:text-[#14110a] hover:bg-[#ff8a33]/10"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
                    }`}
                    title={project.name}
                  >
                    {/* Gradient highlight for selected project */}
                    {isSelected && (
                      <div className={selectedProjectOverlayClass} />
                    )}

                    {/* Status Letter */}
                    <span
                      className={`relative z-10 flex items-center justify-center size-5 text-sm font-extrabold shrink-0 ${
                        project.status === "realization"
                          ? isIndustrialSkin ? "text-[#ff8a33]" : "text-amber-500"
                          : isIndustrialSkin ? "text-[#5da6ff]" : "text-blue-500"
                      }`}
                    >
                      {project.status === "realization" ? "R" : "S"}
                    </span>

                    {/* Project Name */}
                    <span className="relative z-10 flex-1 break-words whitespace-normal leading-snug">
                      {project.name}
                    </span>

                    {/* Expand Button */}
                    <button
                      onClick={(e) => toggleProjectExpand(e, project.id)}
                      className={`relative z-10 inline-flex size-7 items-center justify-center rounded-md transition-all ${isIndustrialSkin ? "text-[#6e6757] hover:bg-[#ff8a33]/10 hover:text-[#b03a05]" : "text-slate-400 hover:bg-primary/15 hover:text-primary"} ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px] leading-none">
                        expand_more
                      </span>
                    </button>
                  </div>

                  {/* Submenu */}
                  {isExpanded && (
                    <div className={`flex flex-col ml-3 pl-3 border-l mt-1 mb-1 gap-0.5 animate-in slide-in-from-top-2 duration-200 ${isIndustrialSkin ? "border-[rgba(20,16,8,0.14)]" : "border-slate-200 dark:border-slate-700/50"}`}>
                      {PROJECT_TABS.filter(
                        (tab) => !tab.feature || hasFeature(tab.feature),
                      ).map((tab) => {
                        // Logic to determine if sub-tab is active could be tricky since we don't have tab info in SidebarProps except strictly via currentView/route check which I'd have to implement.
                        // But for sidebar highlight, we can rely on `selectedProjectId` + `activeProjectTab` if Sidebar received it.
                        // Sidebar doesn't receive `activeProjectTab`. MainLayout has it. I should have passed it!
                        // But wait, `isNavItemActive` uses `settingsRoute` which parses URL.
                        // I can parse URL here too or pass the prop.
                        // I'll stick to simple rendering for now, maybe simple highlight if possible.
                        const isTabActive =
                          isSelected &&
                          window.location.search.includes(`tab=${tab.id}`); // Rough check or rely on passed prop if I add it.
                        // Actually, I modified MainLayout to support `activeProjectTab`.
                        // I DID NOT add `activeProjectTab` to SidebarProps yet.
                        // I should probably have done that.
                        // For now, I will skip the "active" highlight for sub-tabs or implement a basic check.
                        // Actually, `useLocation` hook is used in Sidebar (line 62).
                        // `const { search } = useLocation();`
                        // I can check search params.

                        const searchParams = new URLSearchParams(search);
                        const isTabActiveReal =
                          isSelected &&
                          (searchParams.get("tab") || "overview") === tab.id;

                        return (
                          <button
                            key={tab.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onProjectSelect(project.id, tab.id);
                              closeMobileMenu();
                            }}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                              isTabActiveReal
                                ? isIndustrialSkin
                                  ? "text-[#b03a05] border-l-2 border-[#ff8a33] bg-transparent rounded-none font-semibold"
                                  : "text-primary bg-primary/10 font-medium"
                                : isIndustrialSkin
                                  ? "text-[#6e6757] rounded-none hover:text-[#14110a] hover:bg-[#ff8a33]/10"
                                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/30"
                            }`}
                          >
                            <span className={`material-symbols-outlined shrink-0 leading-none ${isIndustrialSkin ? "text-[14px] w-4" : "text-[16px]"}`}>
                              {tab.icon}
                            </span>
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      );
    }

    if (item.type === "group") {
      const isOpen = item.id in openGroups ? openGroups[item.id] : isItemActive;
      const childrenMaxHeightClass =
        item.id === "tools" ? "max-h-[500px]" : "max-h-44";
      return (
        <details
          key={item.id}
          className="group"
          open={isOpen}
          onToggle={(e) => {
            const nextOpen = (e.currentTarget as HTMLDetailsElement).open;
            setOpenGroups((prev) => ({ ...prev, [item.id]: nextOpen }));
          }}
        >
          <summary
            className={`flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg transition-all cursor-pointer list-none ${
              isItemActive
                ? activeNavClass
                : inactiveNavClass
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`material-symbols-outlined shrink-0 ${
                  isItemActive ? "fill" : ""
                }`}
              >
                {item.icon}
              </span>
              <p className="text-[13px] font-medium leading-normal break-words">
                {item.label}
              </p>
            </div>
            <span className="material-symbols-outlined text-[20px] transition-transform group-open:rotate-180 shrink-0">
              expand_more
            </span>
          </summary>

          <div
            className={`flex flex-col mt-1 ml-2 gap-1 ${childrenMaxHeightClass} overflow-y-auto pr-1`}
          >
            {(item.children || []).map((child: any) =>
              renderNavItem(child, item.id),
            )}
          </div>
        </details>
      );
    }

    if (item.type === "external") {
      return (
        <a
          key={item.id}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg transition-all ${inactiveNavClass}`}
          title={item.label}
        >
          <span className="material-symbols-outlined shrink-0">
            {item.icon}
          </span>
          <span className="text-[13px] font-medium break-words">{item.label}</span>
          <span className="material-symbols-outlined ml-auto text-[18px] text-slate-500">
            open_in_new
          </span>
        </a>
      );
    }

    return (
      <button
        key={item.id}
        onClick={() => {
          // Close parent group before navigation
          if (parentId) {
            setOpenGroups((prev) => ({ ...prev, [parentId]: false }));
          }
          onViewChange(
            item.view,
            item.view === "settings"
              ? {
                  settingsTab: item.settingsTab,
                  settingsSubTab: item.settingsSubTab,
                }
              : undefined,
          );
          closeMobileMenu();
        }}
        className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg transition-all group ${
          isItemActive
            ? activeNavClass
            : inactiveNavClass
        }`}
      >
        <span
          className={`material-symbols-outlined shrink-0 text-[20px] ${
            isItemActive
              ? activeIconClass
              : inactiveIconClass
          }`}
        >
          {item.icon}
        </span>
        <p className="text-[13px] leading-none">{item.label}</p>
      </button>
    );
  };

  return (
    <aside
        ref={sidebarRef}
        style={{ width: isOpen ? `${width}px` : "0px" }}
        className={`${sidebarClass} ${
          !isOpen
            ? "overflow-hidden border-none max-md:pointer-events-none max-md:opacity-0"
            : "max-md:opacity-100"
        }`}
      >
        {/* Mobile Overlay */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-[-1] md:hidden"
            onClick={onToggle}
          />
        )}

        {/* Sidebar Content is moved into a wrapper to avoid layout jump during transition */}
        <div
          className={`flex flex-col h-full w-full min-w-[200px] ${
            !isOpen ? "opacity-0 invisible" : "opacity-100 visible"
          } transition-opacity duration-200`}
        >
          {/* Resizer Handle - only on desktop */}
          <div
            className={`hidden md:block absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors z-50 translate-x-[50%] ${isIndustrialSkin ? "hover:bg-[#ff8a33] active:bg-[#ff8a33]" : "hover:bg-primary active:bg-primary"}`}
            onMouseDown={startResizing}
          />

          <div className="flex h-full flex-col p-3 overflow-y-auto">
            <div className="flex flex-col gap-3 flex-1 min-h-0">
              {/* Logo */}
              <div className={`tf-sidebar-brand flex items-center gap-2.5 p-2 py-3 border-b min-w-0 shrink-0 ${isIndustrialSkin ? "border-[rgba(20,16,8,0.10)]" : "border-slate-100 dark:border-slate-800/50"}`}>
                <div className="relative group/logo">
                  <div className={`absolute inset-0 blur-xl rounded-full opacity-0 group-hover/logo:opacity-100 transition-opacity ${isIndustrialSkin ? "bg-[#ff8a33]/20" : "bg-primary/20"}`} />
                  <img
                    src={logo}
                    alt="Tender Flow Logo"
                    className="relative size-10 min-w-10 object-contain drop-shadow-xl shrink-0 transition-transform group-hover/logo:scale-110"
                  />
                </div>
                <div className="flex flex-1 flex-col min-w-0">
                  <h1 className="tf-brand-title text-slate-900 dark:text-white text-base font-black tracking-tight leading-tight whitespace-nowrap truncate">
                    Tender Flow
                  </h1>
                  <p
                    className={`tf-brand-edition ${editionTextClassMap[subscriptionTier]} text-[10px] font-bold uppercase tracking-widest leading-tight whitespace-nowrap truncate`}
                  >
                    {(() => {
                      const tier = subscriptionTier;
                      const labelMap: Record<
                        "free" | "starter" | "pro" | "enterprise" | "admin",
                        string
                      > = {
                        free: "FREE",
                        starter: "STARTER",
                        pro: "PRO",
                        enterprise: "ENTERPRISE",
                        admin: "ENTERPRISE",
                      };
                      return `${labelMap[tier] ?? "FREE"} Edition`;
                    })()}
                  </p>
                </div>
                {/* Close Toggle for Mobile */}
                <button
                  onClick={onToggle}
                  className={`ml-auto p-1.5 rounded-lg transition-colors md:hidden flex items-center justify-center ${isIndustrialSkin ? "text-[#6e6757] hover:text-[#14110a] hover:bg-[#ff8a33]/10" : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                  title="Zavřít"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Navigation */}
              <nav className="tf-sidebar-nav flex flex-col gap-1 mt-2 flex-1 overflow-y-auto">
                {SIDEBAR_NAVIGATION.map((item) => renderNavItem(item))}
              </nav>
            </div>

            <div className={`mt-auto border-t p-3 ${isIndustrialSkin ? "border-[rgba(20,16,8,0.10)]" : "border-slate-200 dark:border-slate-700/50"}`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`text-xs font-mono ${isIndustrialSkin ? "text-[#9c9684]" : "text-slate-400 dark:text-slate-500"}`}>
                  v{APP_VERSION}
                </span>
                <button
                  onClick={onToggle}
                  className={`inline-flex items-center justify-center rounded-lg p-1.5 transition-colors ${isIndustrialSkin ? "text-[#6e6757] hover:bg-[#ff8a33]/10 hover:text-[#14110a]" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"}`}
                  title="Skrýt panel"
                  aria-label="Skrýt panel"
                >
                  <span className="material-symbols-outlined text-[22px]">
                    keyboard_double_arrow_left
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
  );
};
