import React, { Suspense, useEffect, useState } from "react";
import { MainLayout } from "@/components/layouts/MainLayout";
import { UpdateBanner } from "@/components/desktop";
import { RequireFeature } from "@/shared/routing/RequireFeature";
import { ShortUrlRedirect } from "@/shared/routing/ShortUrlRedirect";
import { useLocation, navigate } from "@/shared/routing/router";
import { buildAppUrl } from "@/shared/routing/routeUtils";
import { FEATURES } from "@/config/features";
import { useAuth } from "@/context/AuthContext";
import { useFeatures } from "@/context/FeatureContext";
import { useUI } from "@/context/UIContext";
import { useDesktop } from "@/hooks/useDesktop";
import { useAppData } from "@/hooks/useAppData";
import { useTheme } from "@/hooks/useTheme";
import { View } from "@/types";
import { platformAdapter } from "@/services/platformAdapter";
import { useDesktopMcpTokenSync } from "@app/hooks/useDesktopMcpTokenSync";
import { useRouteStateSync } from "@app/hooks/useRouteStateSync";
import { useStuckLoadingRecovery } from "@app/hooks/useStuckLoadingRecovery";
import { AuthGate } from "@app/views/AuthGate";
import { AppLoadErrorView } from "@app/views/AppLoadErrorView";
import { AppLoadingView } from "@app/views/AppLoadingView";
import { AgentFloatingPanel } from "@shared/ui/agent/AgentFloatingPanel";
import {
  INCIDENT_FATAL_EVENT_NAME,
  setIncidentContext,
} from "@/services/incidentLogger";
import type { FatalIncidentNotice } from "@/shared/types/incidents";
import type { AgentRuntimeSnapshot } from "@shared/types/agent";
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
import { LegalAcceptanceModal } from "@/features/auth/ui/LegalAcceptanceModal";
import { requiresLegalAcceptance } from "@/shared/legal/legalDocumentVersions";

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

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [activeProjectTab, setActiveProjectTab] = useState<string>("overview");
  const [activePipelineCategoryId, setActivePipelineCategoryId] = useState<string | null>(null);
  const [isLegalAcceptanceSaving, setIsLegalAcceptanceSaving] = useState(false);

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

      showUiModal({
        title: "Došlo k chybě",
        message: `Kód incidentu: ${detail.incidentId}\n\nProsím pošli tento kód podpoře.`,
        variant: "danger",
        confirmLabel: "Kopírovat kód",
        cancelLabel: "Zavřít",
        onConfirm: () => {
          if (!navigator.clipboard?.writeText) return;
          void navigator.clipboard.writeText(detail.incidentId).catch(() => undefined);
        },
      });
    };

    window.addEventListener(INCIDENT_FATAL_EVENT_NAME, handleFatalIncident as EventListener);
    return () => {
      window.removeEventListener(INCIDENT_FATAL_EVENT_NAME, handleFatalIncident as EventListener);
    };
  }, [showUiModal]);

  useDesktopMcpTokenSync();

  const desktopAllowedTiers = ["pro", "enterprise", "admin"] as const;
  const isDesktopPlanBlocked =
    isDesktop &&
    isAuthenticated &&
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

  if (isDesktopPlanBlocked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="mb-8 rounded-2xl border border-amber-300/60 bg-amber-50 text-amber-900 px-5 py-4 text-sm">
            Desktop aplikace je dostupná pro tarif PRO a vyšší. Pokud máte Free nebo Starter,
            prosím použijte webovou aplikaci. Pro pokračování na desktopu aktivujte
            PRO/Enterprise předplatné.
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

  const agentRuntime: AgentRuntimeSnapshot = {
    pathname,
    search,
    currentView,
    activeProjectTab,
    selectedProjectId: state.selectedProjectId,
    projects: state.projects,
    projectDetails: state.allProjectDetails,
    contacts: state.contacts,
    audience: "internal",
    contextScopes: ["project", "memory", "manual"],
    contextPolicyVersion: "v1-strict-allowlist",
    organizationId: user?.organizationId || null,
    userId: user?.id || null,
    isAdmin: state.isAdmin,
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

  return (
    <>
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

        {isDesktop && <UpdateBanner />}
      </MainLayout>
      <LegalAcceptanceModal
        isOpen={shouldRequireLegalAcceptance}
        isSubmitting={isLegalAcceptanceSaving}
        onAccept={handleAcceptLegalDocuments}
      />
      <AgentFloatingPanel runtime={agentRuntime} />
    </>
  );
};
