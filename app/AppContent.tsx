import React, { Suspense, useEffect, useState } from "react";
import { MainLayout } from "@/components/layouts/MainLayout";
import { DesktopWelcome, UpdateBanner } from "@/components/desktop";
import { RequireFeature } from "@/shared/routing/RequireFeature";
import { ShortUrlRedirect } from "@/shared/routing/ShortUrlRedirect";
import { useLocation, navigate } from "@/shared/routing/router";
import { buildAppUrl } from "@/shared/routing/routeUtils";
import { FEATURES } from "@/config/features";
import { useAuth } from "@/context/AuthContext";
import { useUI } from "@/context/UIContext";
import { useDesktop } from "@/hooks/useDesktop";
import { useAppData } from "@/hooks/useAppData";
import { useTheme } from "@/hooks/useTheme";
import { View } from "@/types";
import { useDesktopMcpTokenSync } from "@app/hooks/useDesktopMcpTokenSync";
import { useRouteStateSync } from "@app/hooks/useRouteStateSync";
import { useStuckLoadingRecovery } from "@app/hooks/useStuckLoadingRecovery";
import { AuthGate } from "@app/views/AuthGate";
import { AppLoadErrorView } from "@app/views/AppLoadErrorView";
import { AppLoadingView } from "@app/views/AppLoadingView";
import {
  AppLazyFallback,
  Contacts,
  Dashboard,
  ProjectLayout,
  ProjectManager,
  ProjectOverview,
  Settings,
  UrlShortener,
} from "@app/views/LazyViews";
import { getLegalPage } from "@app/views/LegalPageRouter";

export const AppContent: React.FC = () => {
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    logout,
    updatePreferences,
  } = useAuth();
  const { showUiModal, uiModal, closeUiModal } = useUI();
  const { pathname, search } = useLocation();
  const { isDesktop, showWelcome, dismissWelcome, selectFolder } = useDesktop();

  const { state, actions } = useAppData(showUiModal);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [activeProjectTab, setActiveProjectTab] = useState<string>("overview");
  const [activePipelineCategoryId, setActivePipelineCategoryId] = useState<string | null>(null);

  useRouteStateSync({
    isAuthenticated,
    pathname,
    search,
    selectedProjectId: state.selectedProjectId,
    activePipelineCategoryId,
    setSelectedProjectId: actions.setSelectedProjectId,
    setCurrentView,
    setActiveProjectTab,
    setActivePipelineCategoryId,
  });

  const { theme, setTheme, primaryColor, setPrimaryColor } = useTheme({
    user,
    onPreferencesUpdate: (prefs) => updatePreferences(prefs),
  });

  useEffect(() => {
    try {
      if (window.self !== window.top && "scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {
      // ignore iframe access errors
    }
  }, []);

  useDesktopMcpTokenSync();

  const isAppPath = pathname === "/app" || pathname.startsWith("/app/");
  const shouldShowLoader = (authLoading && isAppPath) || (isAuthenticated && state.isDataLoading);

  useStuckLoadingRecovery({
    shouldShowLoader,
    isDataLoading: state.isDataLoading,
    isDesktop,
    logout,
  });

  if (shouldShowLoader) {
    return (
      <AppLoadingView
        authLoading={authLoading}
        isDataLoading={state.isDataLoading}
        appLoadProgress={state.appLoadProgress}
      />
    );
  }

  if (pathname.startsWith("/s/")) {
    const code = pathname.split("/s/")[1];
    return <ShortUrlRedirect code={code} />;
  }

  if (state.loadingError) {
    return (
      <AppLoadErrorView
        error={state.loadingError}
        onReload={() => window.location.reload()}
        onLogout={() => logout()}
      />
    );
  }

  const legalPage = getLegalPage(pathname);
  if (legalPage) {
    return legalPage;
  }

  if (!isAuthenticated) {
    return (
      <AuthGate
        pathname={pathname}
        search={search}
        isDesktop={isDesktop}
        showWelcome={showWelcome}
        dismissWelcome={dismissWelcome}
        selectFolder={selectFolder}
      />
    );
  }

  const handleNavigateToProject = (id: string, tab: string = "overview") => {
    actions.setSelectedProjectId(id);
    navigate(buildAppUrl("project", { projectId: id, tab: tab as any }));
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case "dashboard":
        return (
          <Dashboard
            projects={state.projects}
            projectDetails={state.allProjectDetails}
            onUpdateProjectDetails={actions.handleUpdateProjectDetails}
            onNavigateToProject={handleNavigateToProject}
          />
        );
      case "project":
        if (!state.selectedProjectId) {
          return (
            <div className="flex items-center justify-center h-full text-slate-600 dark:text-slate-300">
              Vyberte projekt…
            </div>
          );
        }

        if (!state.allProjectDetails[state.selectedProjectId]) {
          return <AppLazyFallback />;
        }

        return (
          <RequireFeature feature={FEATURES.MODULE_PROJECTS}>
            <ProjectLayout
              projectId={state.selectedProjectId}
              projectDetails={state.allProjectDetails[state.selectedProjectId]}
              onUpdateDetails={(updates) =>
                actions.handleUpdateProjectDetails(state.selectedProjectId!, updates)
              }
              onAddCategory={(cat) => actions.handleAddCategory(state.selectedProjectId!, cat)}
              onEditCategory={(cat) => actions.handleEditCategory(state.selectedProjectId!, cat)}
              onDeleteCategory={(catId) =>
                actions.handleDeleteCategory(state.selectedProjectId!, catId)
              }
              onBidsChange={actions.handleBidsChange}
              activeTab={activeProjectTab}
              onTabChange={(tab) => {
                setActiveProjectTab(tab);
                if (tab !== "pipeline") {
                  setActivePipelineCategoryId(null);
                }

                navigate(
                  buildAppUrl("project", {
                    projectId: state.selectedProjectId!,
                    tab,
                    categoryId:
                      tab === "pipeline" ? (activePipelineCategoryId ?? undefined) : undefined,
                  }),
                );
              }}
              contacts={state.contacts}
              statuses={state.contactStatuses}
              onUpdateContact={actions.handleUpdateContact}
              initialPipelineCategoryId={activePipelineCategoryId ?? undefined}
              onNavigateToPipeline={(catId) => {
                setActiveProjectTab("pipeline");
                setActivePipelineCategoryId(catId);
                navigate(
                  buildAppUrl("project", {
                    projectId: state.selectedProjectId!,
                    tab: "pipeline",
                    categoryId: catId,
                  }),
                );
              }}
              onCategoryNavigate={(catId) => {
                setActivePipelineCategoryId(catId);
                navigate(
                  buildAppUrl("project", {
                    projectId: state.selectedProjectId!,
                    tab: "pipeline",
                    categoryId: catId ?? undefined,
                  }),
                );
              }}
            />
          </RequireFeature>
        );
      case "contacts":
        return (
          <RequireFeature feature={FEATURES.MODULE_CONTACTS}>
            <Contacts
              statuses={state.contactStatuses}
              contacts={state.contacts}
              onContactsChange={actions.setContacts}
              onAddContact={actions.handleAddContact}
              onUpdateContact={actions.handleUpdateContact}
              onBulkUpdateContacts={actions.handleBulkUpdateContacts}
              onDeleteContacts={actions.handleDeleteContacts}
              isAdmin={state.isAdmin}
            />
          </RequireFeature>
        );
      case "settings":
        return (
          <Settings
            theme={theme}
            onSetTheme={setTheme}
            primaryColor={primaryColor}
            onSetPrimaryColor={setPrimaryColor}
            contactStatuses={state.contactStatuses}
            onUpdateStatuses={actions.setContactStatuses}
            onImportContacts={actions.handleImportContacts}
            onDeleteContacts={actions.handleDeleteContacts}
            contacts={state.contacts}
            isAdmin={state.isAdmin}
            onSaveSettings={async () => {}}
            user={user}
          />
        );
      case "project-management":
        return (
          <ProjectManager
            projects={state.projects}
            onAddProject={actions.handleAddProject}
            onDeleteProject={actions.handleDeleteProject}
            onArchiveProject={actions.handleArchiveProject}
          />
        );
      case "project-overview":
        return (
          <RequireFeature feature={FEATURES.FEATURE_ADVANCED_REPORTING}>
            <ProjectOverview
              projects={state.projects}
              projectDetails={state.allProjectDetails}
            />
          </RequireFeature>
        );
      case "url-shortener":
        return (
          <RequireFeature feature={FEATURES.URL_SHORTENER}>
            <UrlShortener />
          </RequireFeature>
        );
      default:
        return (
          <Dashboard
            projects={state.projects}
            projectDetails={state.allProjectDetails}
            onUpdateProjectDetails={actions.handleUpdateProjectDetails}
            onNavigateToProject={handleNavigateToProject}
          />
        );
    }
  };

  return (
    <MainLayout
      uiModal={uiModal}
      closeUiModal={closeUiModal}
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
      currentView={currentView}
      projects={state.projects}
      selectedProjectId={state.selectedProjectId}
      onProjectSelect={handleNavigateToProject}
      activeProjectTab={activeProjectTab}
      user={user}
      isBackgroundLoading={state.isBackgroundLoading}
      backgroundWarning={state.backgroundWarning}
      onReloadData={() => actions.loadInitialData(true)}
      onHideBackgroundWarning={() => actions.setBackgroundWarning(null)}
    >
      <Suspense fallback={<AppLazyFallback />}>{renderCurrentView()}</Suspense>

      {isDesktop && showWelcome && (
        <DesktopWelcome onClose={dismissWelcome} onSelectFolder={selectFolder} />
      )}

      {isDesktop && <UpdateBanner />}
    </MainLayout>
  );
};
