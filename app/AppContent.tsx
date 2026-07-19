import React, { Suspense, useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layouts/MainLayout";
import { UpdateBanner } from "@/components/desktop";
import { RequireFeature } from "@/shared/routing/RequireFeature";
import { ShortUrlRedirect } from "@/shared/routing/ShortUrlRedirect";
import { useLocation, navigate } from "@/shared/routing/router";
import { DEFAULT_APP_VIEW, buildAppUrl } from "@/shared/routing/routeUtils";
import { FEATURES } from "@/config/features";
import { useAuth } from "@/context/AuthContext";
import { useFeatures } from "@/context/FeatureContext";
import { useUI } from "@/context/UIContext";
import { useDesktop } from "@/hooks/useDesktop";
import { useAppData } from "@/hooks/useAppData";
import { useTheme } from "@/hooks/useTheme";
import type {
  DemandCategory,
  ProjectDetails,
  ProjectTab,
  View,
} from "@/types";
import { platformAdapter } from "@/services/platformAdapter";
import { useDesktopMcpTokenSync } from "@app/hooks/useDesktopMcpTokenSync";
import { usePosthogIdentity } from "@app/hooks/usePosthogIdentity";
import { useAppUsageHeartbeat } from "@app/hooks/useAppUsageHeartbeat";
import { useCriticalLoadIncident } from "@app/hooks/useCriticalLoadIncident";
import { useRouteStateSync } from "@app/hooks/useRouteStateSync";
import { useStuckLoadingRecovery } from "@app/hooks/useStuckLoadingRecovery";
import { AuthGate } from "@app/views/AuthGate";
import { AppLoadErrorView } from "@app/views/AppLoadErrorView";
import { AppLoadingView } from "@app/views/AppLoadingView";
import {
  INCIDENT_FATAL_EVENT_NAME,
  setIncidentContext,
} from "@/services/incidentLogger";
import type { FatalIncidentNotice } from "@/shared/types/incidents";
import {
  AppLazyFallback,
  CommandCenterView,
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
import { WhatsNewModal } from "@/features/whats-new/WhatsNewModal";
import { useWhatsNew } from "@/features/whats-new/useWhatsNew";
import { GlobalSearchProvider, GlobalSearchModal } from "@/shared/ui/GlobalSearch";
import { TopbarActionsProvider } from "@/shared/ui/TopbarActionsContext";
import { useAutoBackupScheduler } from "@/features/backup/hooks/useAutoBackupScheduler";
import { useAllContractsQuery } from "@/features/projects/contracts/hooks/useAllContractsQuery";
import { VoiceAssistantProvider } from "@/features/voice-assistant/context/VoiceAssistantContext";
import { shouldEnableVoiceAssistantForRoute } from "@/features/voice-assistant/model/routeAvailability";
import { VoiceAssistantLauncher } from "@/features/voice-assistant/ui/VoiceAssistantLauncher";
import { VoiceAssistantPanel } from "@/features/voice-assistant/ui/VoiceAssistantPanel";
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

  const { state, actions } = useAppData(showUiModal);
  const criticalLoadIncident = useCriticalLoadIncident(state.loadingErrorDiagnostic);
  const isVoiceAssistantAdmin = user?.role === "admin";
  const projectIds = useMemo(() => state.projects.map((project) => project.id), [state.projects]);
  const { data: voiceContracts = [] } = useAllContractsQuery(
    projectIds,
    isVoiceAssistantAdmin && isDesktop && isAuthenticated && !authLoading,
  );
  const contractsByProject = useMemo(
    () =>
      voiceContracts.reduce<Record<string, typeof voiceContracts>>((acc, contract) => {
        (acc[contract.projectId] ??= []).push(contract);
        return acc;
      }, {}),
    [voiceContracts],
  );

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState<View>(DEFAULT_APP_VIEW);
  const [activeProjectTab, setActiveProjectTab] = useState<string>("overview");
  const [activePipelineCategoryId, setActivePipelineCategoryId] = useState<string | null>(null);
  const [isLegalAcceptanceSaving, setIsLegalAcceptanceSaving] = useState(false);
  const { isOpen: isWhatsNewOpen, dismiss: dismissWhatsNew } = useWhatsNew();

  useAutoBackupScheduler();

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

  useDesktopMcpTokenSync();
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
      case "command-center":
        return (
          <RequireFeature feature={FEATURES.MODULE_COMMAND_CENTER}>
            <CommandCenterView />
          </RequireFeature>
        );
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

        if (!state.allProjectDetails[state.selectedProjectId]) {
          return <AppLazyFallback />;
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
              currentUserId={user?.id}
              onNavigateToPipeline={(catId: string) => {
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
      case "url-shortener":
        return (
          <RequireFeature feature={FEATURES.URL_SHORTENER}>
            <UrlShortener />
          </RequireFeature>
        );
      default:
        return (
          <RequireFeature feature={FEATURES.MODULE_COMMAND_CENTER}>
            <CommandCenterView />
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
    projectDetails: state.allProjectDetails,
  };
  const voiceSources = {
    ...searchSources,
    contractsByProject,
  };
  const shouldEnableVoiceAssistantRoute = shouldEnableVoiceAssistantForRoute({
    currentView,
    activeProjectTab,
  });

  return (
    <GlobalSearchProvider sources={searchSources}>
      <VoiceAssistantProvider
        sources={voiceSources}
        currentProjectId={currentView === "project" ? state.selectedProjectId || null : null}
        currentView={currentView}
        isDesktop={isDesktop}
        isAdmin={isVoiceAssistantAdmin && shouldEnableVoiceAssistantRoute}
      >
        <TopbarActionsProvider
          actions={shouldEnableVoiceAssistantRoute ? <VoiceAssistantLauncher /> : null}
        >
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
            <Suspense fallback={<AppLazyFallback />}>{renderCurrentView()}</Suspense>

            {isDesktop && <UpdateBanner />}
          </MainLayout>
        </TopbarActionsProvider>
        {shouldEnableVoiceAssistantRoute && <VoiceAssistantPanel />}
      </VoiceAssistantProvider>
      <LegalAcceptanceModal
        isOpen={shouldRequireLegalAcceptance}
        isSubmitting={isLegalAcceptanceSaving}
        onAccept={handleAcceptLegalDocuments}
      />
      {!shouldRequireLegalAcceptance && (
        <WhatsNewModal isOpen={isWhatsNewOpen} onClose={dismissWhatsNew} />
      )}
      <GlobalSearchModal />
    </GlobalSearchProvider>
  );
};
