import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import type { View, Project } from "../types";
import logo from "../assets/logo.svg";
import { SIDEBAR_NAVIGATION, type NavItemConfig } from "../config/navigation";
import { FEATURES, type FeatureKey } from "../config/features";
import { useFeatures } from "../context/FeatureContext";
import { useLocation, navigate } from "@/shared/routing/router";
import { buildAppUrl } from "@/shared/routing/routeUtils";
import { PORTFOLIO_VIEWS, parsePortfolioStatus, portfolioStorageKey, readPortfolioState } from "@features/projects/model/portfolioState";
import { SidebarUpdateStatus } from "@features/desktop-updater/ui/SidebarUpdateStatus";
import type { ThemeSkin } from "@/shared/types/theme";

import { ProjectSidebar } from "@features/projects/ui/ProjectSidebar";

import { APP_VERSION } from "../config/version";
interface SidebarProps {
  currentView: View;
  onViewChange: (
    view: View,
    opts?: {
      settingsTab?: NonNullable<NavItemConfig["settingsTab"]>;
      settingsSubTab?: NonNullable<NavItemConfig["settingsSubTab"]>;
    },
  ) => void;
  selectedProjectId: string;
  onProjectSelect: (id: string, tab?: string) => void;
  projects: Project[];
  isOpen: boolean;
  onToggle: () => void;
  skin?: ThemeSkin;
  isMobile?: boolean;
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
  isMobile = false,
}) => {
  const { user } = useAuth();
  const { hasFeature } = useFeatures(); // Use feature context
  const { search } = useLocation();
  const portfolioStatus = parsePortfolioStatus(new URLSearchParams(search).get('status'))
    ?? readPortfolioState(portfolioStorageKey(user?.id, user?.organizationId)).status;
  const [width, setWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const compact = !isMobile && !isOpen;
  const [tooltip, setTooltip] = useState<{ label: string; left: number; top: number } | null>(null);
  const showTooltip = (target: EventTarget) => {
    if (!compact || !(target instanceof Element)) return;
    const button = target.closest<HTMLElement>('[aria-label]');
    if (!button || button === sidebarRef.current || !sidebarRef.current?.contains(button)) return;
    const rect = button.getBoundingClientRect();
    setTooltip({ label: button.getAttribute('aria-label')!, left: sidebarRef.current.getBoundingClientRect().right + 8,
      top: Math.max(8, Math.min(rect.top, window.innerHeight - 48)) });
  };
  useEffect(() => { setTooltip(null); }, [compact, currentView, selectedProjectId]);

  useEffect(() => {
    if (!isMobile || !isOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [isMobile, isOpen]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      setTooltip(null);
      if (isMobile && isOpen && !event.defaultPrevented) {
        event.preventDefault();
        onToggle();
      }
    }
    if (!isMobile || !isOpen || event.key !== 'Tab') return;
    const controls = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), summary, [tabindex="0"]',
    ) ?? []).filter(node => !node.closest('[hidden], [inert]'));
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Helper to close sidebar on mobile after navigation
  const closeMobileMenu = () => {
    if (isMobile && isOpen) {
      onToggle();
    }
  };

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
    ? "tf-sidebar relative flex h-full flex-col bg-[#e6e0d2] border-r border-[rgba(20,16,8,0.10)] text-[#14110a] flex-shrink-0 z-20 select-none"
    : "tf-sidebar relative flex h-full flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-shrink-0 z-20 select-none";
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
      subTabParam === "mcp" ||
      subTabParam === "contacts" ||
      subTabParam === "excelUnlocker" ||
      subTabParam === "excelMerger" ||
      subTabParam === "excelIndexer" ||
      subTabParam === "registration" ||
      subTabParam === "users" ||
      subTabParam === "organizations" ||
      subTabParam === "subscriptions" ||
      subTabParam === "ai" ||
      subTabParam === "incidents" ||
      subTabParam === "compliance" ||
      subTabParam === "overview" ||
      subTabParam === "members" ||
      subTabParam === "rolePermissions" ||
      subTabParam === "billing" ||
      subTabParam === "branding" ||
      subTabParam === "tools" // legacy
        ? subTabParam
        : null;
    const subTab = rawSubTab === "tools" ? "excelUnlocker" : rawSubTab;
    return { tab, subTab: subTab as typeof rawSubTab };
  })();

  const isNavItemEnabled = useCallback(
    (item: NavItemConfig) => {
      if (item.feature && !hasFeature(item.feature)) return false;
      return true;
    },
    [hasFeature],
  );

  const isNavItemActive = useCallback(
    (item: NavItemConfig): boolean => {
      if (item.type === "group") {
        return (
          Array.isArray(item.children) &&
          item.children.some(
            (child: NavItemConfig) => isNavItemEnabled(child) && isNavItemActive(child),
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
        const rect = sidebarRef.current?.getBoundingClientRect();
        const scale = rect ? rect.width / width : 1;
        const newWidth = (mouseMoveEvent.clientX - (rect?.left ?? 0)) / scale;
        // Min width 200px, Max width 480px
        if (newWidth >= 200 && newWidth <= 480) {
          setWidth(newWidth);
        }
      }
    },
    [isResizing, width],
  );

  useEffect(() => {
    if (!isResizing) return;
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  type MenuSection = 'projects' | 'contacts' | 'reports' | 'tools';
  const routeSection: MenuSection = currentView === 'contacts' ? 'contacts' : currentView === 'project-overview' || currentView === 'contract-overview'
    ? 'reports' : currentView === 'settings' && settingsRoute.tab === 'tools' ? 'tools' : 'projects';
  const [menuSection, setMenuSection] = useState<MenuSection>(routeSection);
  useEffect(() => { setMenuSection(routeSection); }, [routeSection, currentView, selectedProjectId]);
  const navItem = (id: string) => SIDEBAR_NAVIGATION.find(item => item.id === id);
  const renderItem = (id: string) => { const item = navItem(id); return item ? renderNavItem(item) : null; };
  const reportItems = SIDEBAR_NAVIGATION.filter(item => ['project-overview', 'contract-overview'].includes(item.id) && isNavItemEnabled(item));
  const tools = navItem('tools')?.children?.filter(isNavItemEnabled) ?? [];

  // Helper to render nav items
  const renderNavItem = (item: NavItemConfig, parentId?: string) => {
    if (!isNavItemEnabled(item)) {
      return null;
    }

    const isItemActive = isNavItemActive(item);

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
            aria-label={item.label}
            data-help-id="sidebar-nav-group-summary"
            data-active={isItemActive ? "true" : "false"}
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
              <p className="tf-sidebar-label text-[13px] font-medium leading-normal break-words">
                {item.label}
              </p>
            </div>
            <span className="tf-sidebar-label material-symbols-outlined text-[20px] transition-transform group-open:rotate-180 shrink-0">
              expand_more
            </span>
          </summary>

          <div
            className={`tf-sidebar-submenu flex flex-col mt-1 gap-1 ${childrenMaxHeightClass} overflow-y-auto`}
          >
            {(item.children || []).map((child: NavItemConfig) =>
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
          aria-label={item.label}
          data-help-id="sidebar-nav-item"
          data-active="false"
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg transition-all ${inactiveNavClass}`}
          title={item.label}
        >
          <span className="material-symbols-outlined shrink-0">
            {item.icon}
          </span>
          <span className="tf-sidebar-label text-[13px] font-medium break-words">{item.label}</span>
          <span className="material-symbols-outlined ml-auto text-[18px] text-slate-500">
            open_in_new
          </span>
        </a>
      );
    }

    return (
      <button
        key={item.id}
        aria-label={item.label}
          data-help-id="sidebar-nav-item"
        data-active={isItemActive ? "true" : "false"}
        aria-current={isItemActive ? "page" : undefined}
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
          aria-hidden="true"
          data-help-id="sidebar-nav-icon"
          className={`material-symbols-outlined shrink-0 text-[20px] ${
            isItemActive
              ? activeIconClass
              : inactiveIconClass
          }`}
        >
          {item.icon}
        </span>
        <p className="tf-sidebar-label text-[13px] leading-none">{item.label}</p>
      </button>
    );
  };

  return (
    <>
    <aside
        id="app-sidebar"
        ref={sidebarRef}
        aria-label="Hlavní navigace"
        role={isMobile ? 'dialog' : undefined}
        aria-modal={isMobile && isOpen ? true : undefined}
        aria-hidden={isMobile && !isOpen ? true : undefined}
        inert={isMobile && !isOpen}
        data-compact={compact}
        data-mobile={isMobile}
        data-open={isOpen}
        data-resizing={isResizing}
        style={{ width: compact ? '72px' : `${width}px` }}
        className={sidebarClass}
        onKeyDown={handleKeyDown}
        onMouseOver={event => showTooltip(event.target)}
        onFocus={event => showTooltip(event.target)}
        onMouseLeave={() => setTooltip(null)}
        onBlur={() => setTooltip(null)}
        onScrollCapture={() => setTooltip(null)}
      >
        <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
          {!isMobile && isOpen && <div
            className={`absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors z-50 ${isIndustrialSkin ? "hover:bg-[#ff8a33] active:bg-[#ff8a33]" : "hover:bg-primary active:bg-primary"}`}
            onMouseDown={startResizing}
          />}
          <div className="tf-sidebar-content flex h-full min-h-0 flex-col p-3">

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
                <div className="tf-sidebar-label flex flex-1 flex-col min-w-0">
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
                {!isMobile && <button
                  type="button"
                  onClick={onToggle}
                  aria-controls="app-sidebar"
                  aria-expanded={isOpen}
                  className={`tf-sidebar-toggle inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 transition-colors ${isIndustrialSkin ? "text-[#6e6757] hover:bg-[#ff8a33]/10 hover:text-[#14110a]" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"}`}
                  title={compact ? "Rozbalit hlavní menu" : "Sbalit menu"}
                  aria-label={compact ? "Rozbalit hlavní menu" : "Sbalit menu"}
                >
                  <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                    {compact ? "keyboard_double_arrow_right" : "keyboard_double_arrow_left"}
                  </span>
                </button>}
                {/* Close Toggle for Mobile */}
                {isMobile && <button
                  type="button"
                  ref={closeRef}
                  onClick={onToggle}
                  className={`ml-auto p-1.5 rounded-lg transition-colors flex items-center justify-center ${isIndustrialSkin ? "text-[#6e6757] hover:text-[#14110a] hover:bg-[#ff8a33]/10" : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                  title="Zavřít"
                  aria-label="Zavřít sidebar"
                  aria-controls="app-sidebar"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>}
              </div>

              {/* Navigation */}
              <div className="tf-sidebar-nav flex flex-col gap-3 mt-2 flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
                <nav aria-label="Oblasti aplikace" className="tf-sidebar-sections flex flex-col gap-2 shrink-0">
                  {([
                    { id: 'projects', label: 'Stavby', icon: 'apartment', enabled: hasFeature(FEATURES.MODULE_PROJECTS) },
                    { id: 'contacts', label: 'Dodavatelé', icon: 'handshake', enabled: hasFeature(FEATURES.MODULE_CONTACTS) },
                    { id: 'reports', label: 'Přehledy', icon: 'monitoring', enabled: reportItems.length > 0 },
                    { id: 'tools', label: 'Nástroje', icon: 'build', enabled: tools.length > 0 },
                  ] as const).filter(item => item.enabled).map(item => <button key={item.id} type="button"
                    aria-label={item.label} aria-pressed={menuSection === item.id} data-active={menuSection === item.id}
                    className="tf-sidebar-section flex min-w-0 items-center gap-3 px-3 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    onClick={() => {
                      setMenuSection(item.id);
                      if (item.id === 'projects') { onViewChange('project-management', undefined); closeMobileMenu(); }
                      if (item.id === 'contacts') { onViewChange('contacts', undefined); closeMobileMenu(); }
                    }}>
                    <span aria-hidden="true" className="material-symbols-outlined text-xl">{item.icon}</span><span className="tf-sidebar-label">{item.label}</span>
                  </button>)}
                </nav>
                <div className="tf-sidebar-context shrink-0">
                  {menuSection === 'projects' && hasFeature(FEATURES.MODULE_PROJECTS) && <>
                    {currentView !== 'project' && <nav aria-label="Pohledy staveb">
                      {PORTFOLIO_VIEWS.map(view => <button key={view.id} type="button"
                        aria-label={view.label} aria-current={currentView === 'project-management' && portfolioStatus === view.id ? 'page' : undefined}
                        data-active={currentView === 'project-management' && portfolioStatus === view.id}
                        className="tf-project-nav-row flex w-full items-center gap-2.5 border-l-2 border-transparent px-6 py-2.5 text-left text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                        onClick={() => { navigate(`${buildAppUrl('project-management')}?status=${view.id}`); closeMobileMenu(); }}>
                        <span aria-hidden="true" className="material-symbols-outlined text-lg">{view.icon}</span><span className="tf-sidebar-label">{view.label}</span>
                      </button>)}
                    </nav>}
                    {currentView === 'project' && <ProjectSidebar compact={compact} onExpand={onToggle} hasFeature={hasFeature} projects={projects} selectedProjectId={selectedProjectId}
                      activeTab={new URLSearchParams(search).get('tab') || 'overview'}
                      activeSettingsTab={new URLSearchParams(search).get('documentsSubTab') || 'pd'}
                      onSelect={(id, tab, settingsTab) => {
                        if (settingsTab) navigate(buildAppUrl('project', { projectId: id, tab: 'project-settings', documentsSubTab: settingsTab }));
                        else onProjectSelect(id, tab);
                        closeMobileMenu();
                      }} />}
                  </>}
                  {menuSection === 'reports' && <nav aria-label="Přehledy" className="tf-sidebar-menu">{reportItems.map(item => renderNavItem(item))}</nav>}
                  {menuSection === 'tools' && <nav aria-label="Nástroje" className="tf-sidebar-menu">{tools.map(item => renderNavItem(item))}</nav>}
                  {menuSection !== 'projects' && currentView === 'project' && <button type="button"
                    aria-label="Zpět k otevřené stavbě"
                    className="tf-sidebar-back mt-6 p-2 text-left text-xs border border-slate-300 dark:border-slate-700 rounded-md"
                    onClick={() => setMenuSection('projects')}><span aria-hidden="true" className="material-symbols-outlined">arrow_back</span><span className="tf-sidebar-label">Zpět k otevřené stavbě: {projects.find(project => project.id === selectedProjectId)?.name}</span></button>}
                </div>
              </div>
            </div>

            <div className={`tf-sidebar-footer shrink-0 mt-auto border-t pt-3 ${isIndustrialSkin ? "border-[rgba(20,16,8,0.10)]" : "border-slate-200 dark:border-slate-700/50"}`}>
              <div className="mb-3 tf-sidebar-nav">{renderItem('todo')}</div>
              <div className="flex items-center justify-between gap-3">
                <SidebarUpdateStatus
                  currentVersion={APP_VERSION}
                  isIndustrialSkin={isIndustrialSkin}
                  compact={compact}
                />

              </div>
            </div>
          </div>
        </div>
      </aside>
      {compact && tooltip && createPortal(
        <div role="tooltip" className="tf-sidebar-tooltip" style={{ left: tooltip.left, top: tooltip.top }}>
          {tooltip.label}
        </div>, document.body,
      )}
    </>
  );
};
