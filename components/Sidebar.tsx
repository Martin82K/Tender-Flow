import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { platformAdapter, isDesktop } from "../services/platformAdapter";
import { View, Project, ProjectTab } from "../types";
import logo from "../assets/logo.png";
import { SIDEBAR_NAVIGATION, BOTTOM_NAVIGATION } from "../config/navigation";
import { FEATURES, type FeatureKey } from "../config/features";
import { useFeatures } from "../context/FeatureContext";
import { useLocation } from "./routing/router";

import { APP_VERSION } from "../config/version";

// Admin role configuration (must match App.tsx)
const ADMIN_EMAILS = ["martinkalkus82@gmail.com", "kalkus@baustav.cz"];
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

// Helper function to get display role
const getUserRole = (
  email: string | undefined,
  defaultRole?: string,
): string => {
  if (!email) return defaultRole || "User";
  if (ADMIN_EMAILS.includes(email)) return "Admin";
  return defaultRole || "User";
};

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
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  selectedProjectId,
  onProjectSelect,
  projects,
  isOpen,
  onToggle,
}) => {
  const { user, logout } = useAuth();
  const { hasFeature } = useFeatures(); // Use feature context
  const { search } = useLocation();
  const [width, setWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const [displayName, setDisplayName] = useState("");
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

  const toggleProjectExpand = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const settingsRoute = (() => {
    const params = new URLSearchParams(search);
    const tabParam = params.get("tab");
    const subTabParam = params.get("subTab");
    const tab = tabParam === "admin" || tabParam === "user" ? tabParam : null;
    const rawSubTab =
      subTabParam === "profile" ||
      subTabParam === "contacts" ||
      subTabParam === "excelUnlocker" ||
      subTabParam === "excelMerger" ||
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

  // Load display name
  useEffect(() => {
    if (user?.id) {
      loadDisplayName();
    }
  }, [user?.id]);

  const loadDisplayName = async () => {
    if (user.role === "demo") {
      setDisplayName("Demo Uživatel");
      return;
    }

    try {
      const { supabase } = await import("../services/supabase");
      const { data, error } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();

      if (data?.display_name) {
        setDisplayName(data.display_name);
      }
    } catch (error) {
      // Silently fail - display name is optional
    }
  };

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
            className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer list-none ${
              currentView === "project"
                ? "bg-primary/20 text-primary border border-primary/30 font-semibold"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`material-symbols-outlined shrink-0 ${
                  currentView === "project" ? "fill text-primary" : ""
                }`}
              >
                {item.icon}
              </span>
              <p className="text-sm leading-normal break-words">{item.label}</p>
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
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border border-dashed border-emerald-500/30 hover:border-emerald-500/50"
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
                    className={`flex items-center gap-3 text-left text-sm px-3 py-2.5 rounded-xl transition-all relative overflow-hidden cursor-pointer group/item ${
                      isSelected
                        ? "text-slate-900 dark:text-white font-semibold"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
                    }`}
                    title={project.name}
                  >
                    {/* Gradient highlight for selected project */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl border-l-2 border-primary" />
                    )}

                    {/* Status Badge */}
                    <span
                      className={`relative z-10 flex items-center justify-center size-5 rounded-lg text-[10px] font-extrabold shrink-0 shadow-sm ${
                        project.status === "realization"
                          ? "bg-amber-500 text-white"
                          : "bg-blue-500 text-white"
                      }`}
                    >
                      {project.status === "realization" ? "R" : "S"}
                    </span>

                    {/* Project Name */}
                    <span className="relative z-10 break-words flex-1 truncate">
                      {project.name}
                    </span>

                    {/* Expand Button */}
                    <button
                      onClick={(e) => toggleProjectExpand(e, project.id)}
                      className={`relative z-10 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 transition-all ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        expand_more
                      </span>
                    </button>
                  </div>

                  {/* Submenu */}
                  {isExpanded && (
                    <div className="flex flex-col ml-3 pl-3 border-l border-slate-200 dark:border-slate-700/50 mt-1 mb-1 gap-0.5 animate-in slide-in-from-top-2 duration-200">
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
                                ? "text-primary bg-primary/10 font-medium"
                                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/30"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">
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
            className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer list-none ${
              isItemActive
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`material-symbols-outlined shrink-0 ${
                  isItemActive ? "fill" : ""
                }`}
              >
                {item.icon}
              </span>
              <p className="text-sm font-medium leading-normal break-words">
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
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
          title={item.label}
        >
          <span className="material-symbols-outlined shrink-0">
            {item.icon}
          </span>
          <span className="text-sm font-medium break-words">{item.label}</span>
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
        className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all group ${
          isItemActive
            ? "bg-primary/10 text-primary border border-primary/20 font-semibold"
            : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"
        }`}
      >
        <span
          className={`material-symbols-outlined shrink-0 text-[20px] ${
            isItemActive
              ? "fill text-primary"
              : "text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-100"
          }`}
        >
          {item.icon}
        </span>
        <p className="text-sm leading-none">{item.label}</p>
      </button>
    );
  };

  // Logout Confirmation State
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogoutClick = () => {
    if (isDesktop) {
      setShowLogoutConfirm(true);
    } else {
      logout();
    }
  };

  const handleConfirmQuit = async () => {
    try {
      if (platformAdapter.app.quit) {
        await platformAdapter.app.quit();
      } else {
        // Fallback or should not happen if types aligned
        window.close();
      }
    } catch (error) {
      console.error("Failed to quit app:", error);
    }
  };

  const handleConfirmLogout = () => {
    logout();
    setShowLogoutConfirm(false);
  };

  return (
    <>
      <aside
        ref={sidebarRef}
        style={{ width: isOpen ? `${width}px` : "0px" }}
        className={`relative flex h-full flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-shrink-0 z-20 select-none group/sidebar transition-all duration-300 ease-in-out max-md:fixed max-md:inset-0 max-md:z-50 max-md:!w-full max-md:h-[100dvh] max-md:max-h-[100dvh] ${
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
            className="hidden md:block absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary active:bg-primary transition-colors z-50 translate-x-[50%]"
            onMouseDown={startResizing}
          />

          <div className="flex h-full flex-col p-4 overflow-y-auto">
            <div className="flex flex-col gap-4 flex-1 min-h-0">
              {/* Logo */}
              <div className="flex items-center gap-3 p-2 py-4 border-b border-slate-100 dark:border-slate-800/50 min-w-0 shrink-0">
                <div className="relative group/logo">
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover/logo:opacity-100 transition-opacity" />
                  <img
                    src={logo}
                    alt="Tender Flow Logo"
                    className="relative size-12 min-w-12 object-contain drop-shadow-xl shrink-0 transition-transform group-hover/logo:scale-110"
                  />
                </div>
                <div className="flex flex-1 flex-col min-w-0">
                  <h1 className="text-slate-900 dark:text-white text-lg font-black tracking-tight leading-tight whitespace-nowrap truncate">
                    Tender Flow
                  </h1>
                  <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-tight whitespace-nowrap truncate">
                    {(() => {
                      const tier = user?.subscriptionTier || "free";
                      switch (tier) {
                        case "pro":
                          return "PRO Edition";
                        case "enterprise":
                        case "admin":
                          return "ENTERPRISE Edition";
                        case "starter":
                          return "STARTER Edition";
                        default:
                          return "FREE Edition";
                      }
                    })()}
                  </p>
                </div>
                {/* Close Toggle for Mobile */}
                <button
                  onClick={onToggle}
                  className="ml-auto p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors md:hidden flex items-center justify-center"
                  title="Zavřít"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Navigation */}
              <nav className="flex flex-col gap-2 mt-4 flex-1 overflow-y-auto">
                {SIDEBAR_NAVIGATION.map((item) => renderNavItem(item))}
              </nav>
            </div>

            {/* Bottom Section */}
            <div className="mt-auto p-3 space-y-2 border-t border-slate-200 dark:border-slate-700/50">
              {/* Sidebar Toggle */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700/50">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Skrýt panel
                </span>
                <button
                  onClick={onToggle}
                  className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center justify-center"
                  title="Skrýt panel"
                  aria-label="Skrýt panel"
                >
                  <span className="material-symbols-outlined text-[22px]">
                    toggle_on
                  </span>
                </button>
              </div>

              {BOTTOM_NAVIGATION.map((item) => renderNavItem(item))}

              <a
                href="/user-manual/index.html"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (isDesktop) {
                    e.preventDefault();
                    // Use openFile for local HTML files - it uses shell.openPath() which works with file:// paths
                    const manualPath = new URL(
                      "/user-manual/index.html",
                      window.location.href,
                    ).pathname;
                    platformAdapter.fs.openFile(manualPath);
                  }
                }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
                title="Otevře uživatelskou příručku v nové záložce"
              >
                <span className="material-symbols-outlined shrink-0">
                  menu_book
                </span>
                <span className="text-sm font-medium break-words">
                  Uživatelská příručka
                </span>
                <span className="material-symbols-outlined ml-auto text-[18px] text-slate-500">
                  open_in_new
                </span>
              </a>

              <div className="flex items-center gap-3 px-3 py-3 mt-2 overflow-hidden bg-slate-50 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
                {user?.subscriptionTier ? (
                  <div className="size-9 min-w-9 flex items-center justify-center">
                    <span
                      className={`badge-neon badge-neon-${user.subscriptionTier}`}
                    >
                      {user.subscriptionTier === "admin"
                        ? "BOSS"
                        : user.subscriptionTier}
                    </span>
                  </div>
                ) : user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="size-9 min-w-9 rounded-full border-2 border-white dark:border-slate-700 shadow-sm"
                  />
                ) : (
                  <div className="size-9 min-w-9 rounded-xl bg-gradient-to-tr from-primary to-primary-light flex items-center justify-center text-white font-black text-sm shadow-inner">
                    {(displayName || user?.email || "U")[0].toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col overflow-hidden flex-1">
                  <p className="text-sm font-extrabold text-slate-800 dark:text-white break-words truncate">
                    {displayName || user?.email?.split("@")[0] || "User"}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter truncate">
                    {getUserRole(user?.email, user?.role)}
                  </p>
                </div>
                <button
                  onClick={handleLogoutClick}
                  className="ml-auto p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                  title="Odhlásit se"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    logout
                  </span>
                </button>
              </div>

              {/* Footer Credit */}
              <div className="px-3 pb-2">
                <div className="h-px bg-slate-700/50 w-full my-3"></div>
                <p className="text-[13px] text-center leading-relaxed font-medium tracking-wide">
                  <span className="text-slate-400 dark:text-slate-500">
                    Created by{" "}
                  </span>
                  <span className="bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent font-bold">
                    Martin Kalkuš 2026
                  </span>
                </p>
                <p className="text-[10px] text-white text-center mt-1 font-mono hover:text-white/80 transition-colors cursor-default">
                  v{APP_VERSION}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-white mb-2">
              Chcete ukončit aplikaci?
            </h3>
            <p className="text-slate-400 mb-6">
              Můžete aplikaci ukončit a zůstat přihlášeni (pro Touch ID), nebo
              se úplně odhlásit.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirmQuit}
                className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">
                  power_settings_new
                </span>
                Ukončit aplikaci (Ponechat přihlášení)
              </button>

              <button
                onClick={handleConfirmLogout}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">logout</span>
                Odhlásit se (Vyžaduje heslo příště)
              </button>

              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full py-2 px-4 text-slate-500 hover:text-white transition-colors text-sm mt-2"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
