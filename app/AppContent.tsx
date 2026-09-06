import React, { Suspense, useEffect, useState } from "react";
import { MainLayout } from "@/components/layouts/MainLayout";
import { RequireFeature } from "@/shared/routing/RequireFeature";
import { ShortUrlRedirect } from "@/shared/routing/ShortUrlRedirect";
import { useLocation, navigate } from "@/shared/routing/router";
import { DEFAULT_APP_VIEW, buildAppUrl, parseAppRoute } from "@/shared/routing/routeUtils";
import { FEATURES } from "@/config/features";
import { useAuth } from "@/context/AuthContext";
import { useFeatures } from "@/context/FeatureContext";
import { useUI } from "@/context/UIContext";
import { useDesktop } from "@/hooks/useDesktop";
import { useProjectSearchQuery } from "@features/projects/hooks/useProjectSearchQuery";
import { useAppData } from "@/hooks/useAppData";
import { useTheme } from "@/hooks/useTheme";
import type {
  DemandCategory,
  ProjectDetails,
  ProjectTab,
  View,
} from "@/types";
import { platformAdapter } from "@infra/platform/platformAdapter";
import { usePosthogIdentity } from "@app/hooks/usePosthogIdentity";
import { useAppUsageHeartbeat } from "@app/hooks/useAppUsageHeartbeat";
import { useCriticalLoadIncident } from "@app/hooks/useCriticalLoadIncident";
import { useProjectBidRealtimeSync } from "@features/projects/hooks/useProjectBidRealtimeSync";
import { useRouteStateSync } from "@app/hooks/useRouteStateSync";
import { useStuckLoadingRecovery } from "@app/hooks/useStuckLoadingRecovery";
import { AuthGate } from "@app/views/AuthGate";
import { AppLoadErrorView } from "@app/views/AppLoadErrorView";
import { ProjectDetailLoadErrorView } from "@app/views/ProjectDetailLoadErrorView";
import { LazyViewErrorBoundary } from "@app/views/LazyViewErrorBoundary";
import { AppLoadingView } from "@app/views/AppLoadingView";
import {
  INCIDENT_FATAL_EVENT_NAME,
  setIncidentContext,
} from "@/services/incidentLogger";
import type { FatalIncidentNotice } from "@/shared/types/incidents";
import {
  AppLazyFallback,
  ContractOverview,
  Contacts,
  ProjectLayout,
  ProjectManager,
  ProjectOverview,
  Settings,
  TasksPage,
  UrlShortener,
} from "@app/views/LazyViews";
import { getLegalPage } from "@app/views/LegalPageRouter";
import { LegalAcceptanceModal } from "@/features/auth/ui/LegalAcceptanceModal";
import { McpOAuthConsentPage } from "@/app/views/McpOAuthConsentPage";
import { requiresLegalAcceptance } from "@/shared/legal/legalDocumentVersions";
import { GlobalSearchProvider, GlobalSearchModal } from "@/shared/ui/GlobalSearch";
import { useAutoBackupScheduler } from "@/features/backup/hooks/useAutoBackupScheduler";
import { APP_CORE_DATA_LOAD_ERROR_CODE } from "@/shared/errors/appLoadError";
import { formatIncidentReference } from "@/shared/errors/incidentReference";

export const AppContent: React.FC = () => {
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    logout,
    updatePreferences,
    acceptLegalDocuments,
  } = useAuth();
  const { showUiModal, uiModal, closeUiModal } = useUI();
  const { pathname, search } = useLocation();
  const { isDesktop } = useDesktop();
  const { currentPlan, isLoading: isFeaturesLoading } = useFeatures();

  const route = parseAppRoute(pathname, search);
  const { state, actions } = useAppData(showUiModal, "view" in route && route.view === "project");
  const projectSearch = useProjectSearchQuery({ userId: user?.id, projects: state.projects });
  const criticalLoadIncident = useCriticalLoadIncident(state.loadingErrorDiagnostic);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState<View>(DEFAULT_APP_VIEW);
  const [activeProjectTab, setActiveProjectTab] = useState<string>("overview");
  const [activePipelineCategoryId, setActivePipelineCategoryId] = useState<string | null>(null);
  const [activeContractId, setActiveContractId] = useState<string | null>(null);
  const [isLegalAcceptanceSaving, setIsLegalAcceptanceSaving] = useState(false);

  useProjectBidRealtimeSync({
    allProjectDetails: state.allProjectDetails,
    selectedProjectId: currentView === "project" ? state.selectedProjectId : null,
    enabled: isAuthenticated && !authLoading && user?.role !== "demo",
  });

  useAutoBackupScheduler();

  useRouteStateSync({
    isAuthenticated,
    pathname,
    search,
    selectedProjectId: state.selectedProjectId,
    activePipelineCategoryId,
    activeContractId,
    setSelectedProjectId: actions.setSelectedProjectId,
    setCurrentView,
    setActiveProjectTab,
    setActivePipelineCategoryId,
    setActiveContractId,
  });

  const {
    theme,
    skin,
    setSkin,
    setTheme,
    primaryColor,
    setPrimaryColor,
    uiScale,
    setUiScale,
    resetUiScale,
  } = useTheme({
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

  useEffect(() => {
    setIncidentContext({
      route: `${pathname}${search}`,
      platform: isDesktop ? "desktop" : "web",
    });
  }, [pathname, search, isDesktop]);

  useEffect(() => {
    const handleFatalIncident = async (event: Event) => {
      const detail = (event as CustomEvent<FatalIncidentNotice>).detail;
      if (!detail?.incidentId) return;
      const reference = formatIncidentReference({
        errorCode: detail.errorCode,
        incidentId: detail.incidentId,
      });

      showUiModal({
        title: "Došlo k chybě",
        message: `${reference}\n\nProsím pošli tuto referenci podpoře.`,
        variant: "danger",
        confirmLabel: "Kopírovat referenci",
        cancelLabel: "Zavřít",
        onConfirm: () => {
          if (!navigator.clipboard?.writeText) return;
          void navigator.clipboard.writeText(reference).catch(() => undefined);
        },
      });
    };

    window.addEventListener(INCIDENT_FATAL_EVENT_NAME, handleFatalIncident as EventListener);
    return () => {
      window.removeEventListener(INCIDENT_FATAL_EVENT_NAME, handleFatalIncident as EventListener);
    };
  }, [showUiModal]);

  usePosthogIdentity();
  useAppUsageHeartbeat({
    enabled: isAuthenticated && !authLoading && user?.role !== "demo" && user?.isOrgMemberActive !== false,
    sessionKey: user?.id ?? null,
  });

  const desktopAllowedTiers = ["enterprise", "admin"] as const;
  const isDesktopPlanBlocked =
    isDesktop &&
    isAuthenticated &&
    !authLoading &&
    !isFeaturesLoading &&
    !desktopAllowedTiers.includes(currentPlan as (typeof desktopAllowedTiers)[number]);
  const webAppUrl = "https://tenderflow.cz";

  useEffect(() => {
    if (!isDesktopPlanBlocked) return;
    const isSubscriptionRoute =
      pathname === "/app/settings" &&
      new URLSearchParams(search).get("subTab") === "subscription";
    if (!isSubscriptionRoute) {
      navigate("/app/settings?tab=user&subTab=subscription", { replace: true });
    }
  }, [isDesktopPlanBlocked, pathname, search]);

  useEffect(() => {
    if (!isAuthenticated || pathname !== "/mfa") return;
    const nextPath = new URLSearchParams(search).get("next") || buildAppUrl(DEFAULT_APP_VIEW);
    navigate(nextPath.startsWith("/") ? nextPath : buildAppUrl(DEFAULT_APP_VIEW), { replace: true });
  }, [isAuthenticated, pathname, search]);

  const isAppPath = pathname === "/app" || pathname.startsWith("/app/");
  const shouldShowLoader = (authLoading && isAppPath) || (isAuthenticated && state.isDataLoading);

  useStuckLoadingRecovery({
    shouldShowLoader,
    isDataLoading: state.isDataLoading,
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
        errorCode={criticalLoadIncident?.errorCode ?? APP_CORE_DATA_LOAD_ERROR_CODE}
        incidentId={criticalLoadIncident?.incidentId ?? null}
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
      />
    );
  }

  if (pathname === "/mfa") {
    return (
      <AppLoadingView
        authLoading={false}
        isDataLoading={false}
        appLoadProgress={{ percent: 100, label: "Přesměrování..." }}
      />
    );
  }

  if (pathname === "/oauth/consent") {
    return <McpOAuthConsentPage />;
  }

  // Block deactivated organization members from accessing the app
  if (user?.organizationId && user.isOrgMemberActive === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-red-600 dark:text-red-400">person_off</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
            Účet deaktivován
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
            Váš účet byl deaktivován administrátorem organizace
            {user.organizationName ? ` ${user.organizationName}` : ''}.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
            Pro obnovení přístupu kontaktujte administrátora vaší organizace.
          </p>
          <button
            onClick={() => logout()}
            className="w-full px-6 py-3 text-sm font-semibold rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
          >
            Odhlásit se
          </button>
        </div>
      </div>
    );
  }

  if (isDesktopPlanBlocked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="mb-8 rounded-2xl border border-amber-300/60 bg-amber-50 text-amber-900 px-5 py-4 text-sm">
            Desktop aplikace je dostupná pouze pro Enterprise účty. Pokud nemáte aktivní
            Enterprise přístup, prosím použijte webovou aplikaci.
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => platformAdapter.shell.openExternal(webAppUrl)}
              className="px-5 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-bold border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Otevřít webovou aplikaci
            </button>
            <button
              onClick={() => logout()}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors"
            >
              Odhlásit se
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleNavigateToProject = (id: string, tab: string = "overview") => {
    actions.setSelectedProjectId(id);
    navigate(buildAppUrl("project", { projectId: id, tab: tab as any }));
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case "todo":
        return (
          <RequireFeature feature={FEATURES.MODULE_TASKS}>
            <TasksPage skin={skin} />
          </RequireFeature>
        );
      case "project":
        if (!state.selectedProjectId) {
          return (
            <div className="flex items-center justify-center h-full text-slate-600 dark:text-slate-300">
              Vyberte projekt…
            </div>
          );
        }

        if (state.selectedProjectDetailsStatus === "error" || state.selectedProjectDetailsStatus === "unavailable") {
          return (
            <RequireFeature feature={FEATURES.MODULE_PROJECTS}>
              <ProjectDetailLoadErrorView
                unavailable={state.selectedProjectDetailsStatus === "unavailable"}
                isFetching={state.isSelectedProjectDetailsFetching}
                onRetry={state.canRetrySelectedProjectDetails ? actions.retrySelectedProjectDetails : undefined}
                onBack={() => navigate(buildAppUrl("project-management"))}
              />
            </RequireFeature>
          );
        }

        if (state.selectedProjectDetailsStatus === "loading" || !state.allProjectDetails[state.selectedProjectId]) {
          return <RequireFeature feature={FEATURES.MODULE_PROJECTS}><AppLazyFallback /></RequireFeature>;
        }

        return (
          <RequireFeature feature={FEATURES.MODULE_PROJECTS}>
            <ProjectLayout
              projectId={state.selectedProjectId}
              projectDetails={state.allProjectDetails[state.selectedProjectId]}
              onUpdateDetails={(updates: Partial<ProjectDetails>) =>
                actions.handleUpdateProjectDetails(state.selectedProjectId!, updates)
              }
              onAddCategory={(cat: DemandCategory) =>
                actions.handleAddCategory(state.selectedProjectId!, cat)
              }
              onEditCategory={(cat: DemandCategory) =>
                actions.handleEditCategory(state.selectedProjectId!, cat)
              }
              onDeleteCategory={(catId: string) =>
                actions.handleDeleteCategory(state.selectedProjectId!, catId)
              }
              onBidsChange={actions.handleBidsChange}
              activeTab={activeProjectTab}
              onTabChange={(tab: ProjectTab) => {
                setActiveProjectTab(tab);
                setActiveContractId(null);
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
              onAddContact={actions.handleAddContact}
              onUpdateContact={actions.handleUpdateContact}
              initialPipelineCategoryId={activePipelineCategoryId ?? undefined}
              initialContractId={activeContractId ?? undefined}
              currentUserId={user?.id}
              currentUser={user}
              onNavigateToPipeline={(catId: string) => {
                setActiveProjectTab("pipeline");
                setActivePipelineCategoryId(catId);
                setActiveContractId(null);
                navigate(
                  buildAppUrl("project", {
                    projectId: state.selectedProjectId!,
                    tab: "pipeline",
                    categoryId: catId,
                  }),
                );
              }}
              onCategoryNavigate={(catId: string | null) => {
                setActivePipelineCategoryId(catId);
                navigate(
                  buildAppUrl("project", {
                    projectId: state.selectedProjectId!,
                    tab: "pipeline",
                    categoryId: catId ?? undefined,
                  }),
                );
              }}
              onNavigateToContract={(contractId: string) => {
                setActiveProjectTab("contracts");
                setActivePipelineCategoryId(null);
                setActiveContractId(contractId);
                navigate(
                  buildAppUrl("project", {
                    projectId: state.selectedProjectId!,
                    tab: "contracts",
                    contractId,
                  }),
                );
              }}
              skin={skin}
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
              tenantScope={user?.organizationId
                ? { organizationId: user.organizationId }
                : { ownerId: user?.id ?? null }}
            />
          </RequireFeature>
        );
      case "settings":
        return (
          <Settings
            theme={theme}
            skin={skin}
            onSetTheme={setTheme}
            onSetSkin={setSkin}
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
            skin={skin}
            onAddProject={actions.handleAddProject}
            onDeleteProject={actions.handleDeleteProject}
            onCloneTenderToRealization={async (projectId: string) => {
              const result = await actions.handleCloneTenderToRealization(projectId);
              actions.setSelectedProjectId(result.projectId);
              navigate(
                buildAppUrl("project", {
                  projectId: result.projectId,
                  tab: "documents",
                  documentsSubTab: "dochub",
                }),
              );
              return result;
            }}
            onArchiveProject={actions.handleArchiveProject}
          />
        );
      case "project-overview":
        return (
          <RequireFeature feature={FEATURES.FEATURE_ADVANCED_REPORTING}>
            <ProjectOverview
              projects={state.projects}
              projectDetails={state.allProjectDetails}
              user={user}
              skin={skin}
            />
          </RequireFeature>
        );
      case "contract-overview":
        return <ContractOverview />;
      case "url-shortener":
        return (
          <RequireFeature feature={FEATURES.URL_SHORTENER}>
            <UrlShortener />
          </RequireFeature>
        );
      default:
        return (
          <RequireFeature feature={FEATURES.MODULE_TASKS}>
            <TasksPage skin={skin} />
          </RequireFeature>
        );
    }
  };

  const shouldRequireLegalAcceptance = requiresLegalAcceptance(user);

  const handleAcceptLegalDocuments = async (input: {
    termsVersion: string;
    privacyVersion: string;
  }) => {
    setIsLegalAcceptanceSaving(true);
    try {
      await acceptLegalDocuments(input);
    } finally {
      setIsLegalAcceptanceSaving(false);
    }
  };

  const searchSources = {
    projects: state.projects,
    contacts: state.contacts,
    projectDetails: projectSearch.data ?? {},
    requestSearch: projectSearch.requestSearch,
    isProjectSearchLoading: projectSearch.isSearchLoading,
    projectSearchError: projectSearch.isError,
    retryProjectSearch: () => { void projectSearch.refetch({ cancelRefetch: false }); },
  };
  return (
    <GlobalSearchProvider sources={searchSources}>
      <MainLayout
        uiModal={uiModal}
        closeUiModal={closeUiModal}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        currentView={currentView}
        projects={state.projects}
        selectedProjectId={state.selectedProjectId ?? ""}
        onProjectSelect={handleNavigateToProject}
        activeProjectTab={activeProjectTab}
        user={user}
        theme={theme}
        skin={skin}
        onSetTheme={setTheme}
        onSetSkin={setSkin}
        uiScale={uiScale}
        onSetUiScale={setUiScale}
        onResetUiScale={resetUiScale}
        onLogout={() => logout()}
        isBackgroundLoading={state.isBackgroundLoading}
        backgroundWarning={state.backgroundWarning}
        onReloadData={() => actions.loadInitialData(true)}
        onHideBackgroundWarning={() => actions.setBackgroundWarning(null)}
      >
        <LazyViewErrorBoundary
          key={currentView}
          onReload={() => window.location.reload()}
          onLogout={() => logout()}
        >
          <Suspense fallback={<AppLazyFallback />}>{renderCurrentView()}</Suspense>
        </LazyViewErrorBoundary>

      </MainLayout>
      <LegalAcceptanceModal
        isOpen={shouldRequireLegalAcceptance}
        isSubmitting={isLegalAcceptanceSaving}
        onAccept={handleAcceptLegalDocuments}
      />
      <GlobalSearchModal />
    </GlobalSearchProvider>
  );
};
