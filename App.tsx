import React, { Suspense, useEffect, useState, useRef } from "react";
import { AppProviders } from "./components/providers/AppProviders";
import { MainLayout } from "./components/layouts/MainLayout";
import { AuthLayout } from "./components/layouts/AuthLayout";
import { useAppData } from "./hooks/useAppData";
import { useAuth } from "./context/AuthContext";
import { useFeatures } from "./context/FeatureContext";
import { useUI } from "./context/UIContext";
import { useTheme } from "./hooks/useTheme";
import { useDesktop } from "./hooks/useDesktop";
import { useLocation, navigate } from "./components/routing/router";
import { buildAppUrl, parseAppRoute } from "./components/routing/routeUtils";
import { View } from "./types";
import { RequireFeature } from "./components/routing/RequireFeature";
import { FEATURES } from "./config/features";
import { DesktopWelcome, UpdateBanner } from "./components/desktop";
import { clearStoredSessionData, supabase } from "./services/supabase";
import { platformAdapter } from "./services/platformAdapter";
import { SubscriptionSettings } from "./components/settings/SubscriptionSettings";

// Components (Lazy)
const ProjectManager = React.lazy(() =>
  import("./components/ProjectManager").then((m) => ({
    default: m.ProjectManager,
  })),
);
const Dashboard = React.lazy(() =>
  import("./components/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const ProjectLayout = React.lazy(() =>
  import("./components/ProjectLayout").then((m) => ({
    default: m.ProjectLayout,
  })),
);
const Contacts = React.lazy(() =>
  import("./components/Contacts").then((m) => ({ default: m.Contacts })),
);
const Settings = React.lazy(() =>
  import("./components/Settings").then((m) => ({ default: m.Settings })),
);
const ProjectOverview = React.lazy(() =>
  import("./components/ProjectOverview").then((m) => ({
    default: m.ProjectOverview,
  })),
);
const UrlShortener = React.lazy(() =>
  import("./components/tools/UrlShortener").then((m) => ({
    default: m.UrlShortener,
  })),
);

// Auth Pages
import { LandingPage } from "./components/LandingPage";
import { LoginPage } from "./components/auth/LoginPage";
import { RegisterPage } from "./components/auth/RegisterPage";
import { ForgotPasswordPage } from "./components/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./components/auth/ResetPasswordPage";
import { LegalTerms } from "./components/public/LegalTerms";
import { LegalPrivacy } from "./components/public/LegalPrivacy";
import { LegalCookies } from "./components/public/LegalCookies";
import { LegalImprint } from "./components/public/LegalImprint";
import { ShortUrlRedirect } from "./components/routing/ShortUrlRedirect";
import {
  ProjectLayoutSkeleton,
  DashboardSkeleton,
} from "./components/ui/SkeletonLoader";

function AppContent() {
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    logout,
    updatePreferences,
  } = useAuth();
  const { currentPlan, isLoading: isFeaturesLoading } = useFeatures();
  const { showUiModal, uiModal, closeUiModal } = useUI();
  const { pathname, search } = useLocation();

  // Desktop features
  const { isDesktop, showWelcome, dismissWelcome, selectFolder } = useDesktop();

  // Data Hook
  const { state, actions } = useAppData(showUiModal);

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [activeProjectTab, setActiveProjectTab] = useState<string>("overview");
  const [activePipelineCategoryId, setActivePipelineCategoryId] = useState<
    string | null
  >(null);

  // Track last navigation to prevent race conditions
  const lastNavigationRef = useRef<{ pathname: string; search: string } | null>(
    null,
  );

  // Sync URL to View - with race condition protection
  useEffect(() => {
    if (!isAuthenticated) return;

    // Skip if same navigation (prevents duplicate processing)
    const navKey = `${pathname}${search}`;
    if (
      lastNavigationRef.current?.pathname === pathname &&
      lastNavigationRef.current?.search === search
    ) {
      return;
    }
    lastNavigationRef.current = { pathname, search };

    const route = parseAppRoute(pathname, search);
    if (!route.isApp) return;

    if ("redirectTo" in route) {
      navigate(route.redirectTo, { replace: true });
      return;
    }

    setCurrentView(route.view);
    if (route.view === "project") {
      if (route.projectId && route.projectId !== state.selectedProjectId) {
        actions.setSelectedProjectId(route.projectId);
      }
      if (route.tab) setActiveProjectTab(route.tab);
      // Always sync categoryId from URL (including clearing when not present)
      setActivePipelineCategoryId(route.categoryId ?? null);
    } else {
      // Reset category ID when leaving project view to prevent stale state
      if (activePipelineCategoryId) {
        setActivePipelineCategoryId(null);
      }
    }
  }, [pathname, search, isAuthenticated]);

  // Theme - using useTheme hook for proper CSS variable application
  const { theme, setTheme, primaryColor, setPrimaryColor } = useTheme({
    user,
    onPreferencesUpdate: (prefs) => updatePreferences(prefs),
  });

  // Scroll Restoration
  useEffect(() => {
    try {
      if (window.self !== window.top && "scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // @ts-ignore - electronAPI is injected via preload
    const api = window.electronAPI;
    if (!api?.platform?.isDesktop || !api?.mcp?.setAuthToken) return;

    let isMounted = true;
    const pushToken = async (token: string | null) => {
      if (!isMounted) return;
      await api.mcp.setAuthToken(token);
    };

    supabase.auth.getSession().then(({ data }) => {
      pushToken(data.session?.access_token ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        pushToken(session?.access_token ?? null);
      },
    );

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Initial Loading Screen
  const isAppPath = pathname === "/app" || pathname.startsWith("/app/");
  const shouldShowLoader =
    (authLoading && isAppPath) || (isAuthenticated && state.isDataLoading);

  // Stuck loading detection - auto-recovery after timeout
  const loadingStartTimeRef = useRef<number | null>(null);
  const STUCK_LOADING_TIMEOUT_MS = 20000; // 20 seconds

  useEffect(() => {
    if (shouldShowLoader || state.isDataLoading) {
      // Start tracking loading time
      if (!loadingStartTimeRef.current) {
        loadingStartTimeRef.current = Date.now();
      }
    } else {
      // Reset when loading completes
      loadingStartTimeRef.current = null;
    }
  }, [shouldShowLoader, state.isDataLoading]);

  // Check for stuck loading state
  useEffect(() => {
    if (!shouldShowLoader && !state.isDataLoading) return;
    if (!loadingStartTimeRef.current) return;

    const checkStuck = setInterval(() => {
      if (!loadingStartTimeRef.current) {
        clearInterval(checkStuck);
        return;
      }

      const elapsed = Date.now() - loadingStartTimeRef.current;
      if (elapsed > STUCK_LOADING_TIMEOUT_MS) {
        console.warn(`[App] Loading stuck for ${elapsed}ms, attempting recovery...`);
        clearInterval(checkStuck);
        loadingStartTimeRef.current = null;

        // Clear potentially corrupted session data
        try {
          clearStoredSessionData();
        } catch { /* ignore */ }

        // Clear desktop credentials if available
        if (isDesktop && window.electronAPI?.session) {
          window.electronAPI.session.clearCredentials().catch(() => {});
        }

        // Redirect to login
        logout();
      }
    }, 2000);

    return () => clearInterval(checkStuck);
  }, [shouldShowLoader, state.isDataLoading, isDesktop, logout]);

  // Desktop features
  // const { isDesktop, showWelcome, dismissWelcome, selectFolder } = useDesktop();
  // Subscription check removed - allowing all users on desktop
  const isDesktopPlanBlocked = false; 

  /* 
  const desktopAllowedTiers = ["pro", "enterprise", "admin"] as const;
  const isDesktopPlanBlocked =
    isDesktop &&
    isAuthenticated &&
    !isFeaturesLoading &&
    !desktopAllowedTiers.includes(
      currentPlan as (typeof desktopAllowedTiers)[number],
    );
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
  */

  if (shouldShowLoader) {
    const percent = state.appLoadProgress?.percent;
    const label = state.appLoadProgress?.label;
    let loadingMessage = "Načítám aplikaci...";
    if (authLoading && state.isDataLoading)
      loadingMessage = "Načítám aplikaci a data...";
    else if (authLoading) loadingMessage = "Ověřování přihlášení...";
    else if (state.isDataLoading) loadingMessage = "Načítám data...";

    const displayPercent =
      typeof percent === "number"
        ? percent
        : authLoading
          ? 30
          : state.isDataLoading
            ? 60
            : 0;

    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-4 px-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <div className="w-full max-w-sm">
          <p className="text-lg font-medium mb-4">{loadingMessage}</p>
          <div className="mt-4">
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-primary transition-[width] duration-300"
                style={{
                  width: `${Math.max(0, Math.min(100, displayPercent))}%`,
                }}
              />
            </div>
            {label && (
              <div className="mt-3 text-sm text-white/70 truncate">{label}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /*
  if (isDesktopPlanBlocked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="mb-8 rounded-2xl border border-amber-300/60 bg-amber-50 text-amber-900 px-5 py-4 text-sm">
            Desktop aplikace je dostupná pro tarif PRO a vyšší. Pokud máte
            Free nebo Starter, prosím použijte webovou aplikaci. Pro pokračování
            na desktopu aktivujte PRO/Enterprise předplatné.
          </div>
          <SubscriptionSettings />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
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
  */

  // Handle Short Link Redirect
  // This must be checked before other loading states to ensure fast redirect
  if (pathname.startsWith("/s/")) {
    const code = pathname.split("/s/")[1];
    return <ShortUrlRedirect code={code} />;
  }

  if (state.loadingError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-6 p-4 text-center">
        <div className="text-red-500 text-5xl">
          <span className="material-symbols-outlined text-6xl">error</span>
        </div>
        <h1 className="text-2xl font-bold">Chyba při načítání</h1>
        <p className="text-gray-400 max-w-md">{state.loadingError}</p>
        <div className="flex gap-4">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-primary hover:bg-primary/90 rounded-lg font-bold"
          >
            Obnovit stránku
          </button>
          <button
            onClick={() => logout()}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold"
          >
            Odhlásit se
          </button>
        </div>
      </div>
    );
  }

  const legalPageByPath: Record<string, React.ReactNode> = {
    "/terms": <LegalTerms />,
    "/privacy": <LegalPrivacy />,
    "/cookies": <LegalCookies />,
    "/imprint": <LegalImprint />,
  };

  if (legalPageByPath[pathname]) {
    return legalPageByPath[pathname];
  }

  if (!isAuthenticated) {
    if (pathname === "/") {
      if (isDesktop) {
        if (showWelcome) {
          return (
            <div className="fixed inset-0 bg-slate-950">
              <DesktopWelcome
                onClose={() => {
                  dismissWelcome();
                  navigate("/login", { replace: true });
                }}
                onSelectFolder={selectFolder}
              />
            </div>
          );
        }
        navigate("/login", { replace: true });
        return null;
      }
      return <LandingPage />;
    }

    // For unknown routes, redirect to login with the original path as next parameter
    if (
      ![
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/",
      ].includes(pathname)
    ) {
      const nextUrl = encodeURIComponent(pathname + search);
      navigate(`/login?next=${nextUrl}`, { replace: true });
      return null;
    }

    return (
      <AuthLayout>
        {pathname === "/login" && <LoginPage />}
        {pathname === "/register" && <RegisterPage />}
        {pathname === "/forgot-password" && <ForgotPasswordPage />}
        {pathname === "/reset-password" && <ResetPasswordPage />}
      </AuthLayout>
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
        if (!state.selectedProjectId)
          return (
            <div className="flex items-center justify-center h-full text-slate-600 dark:text-slate-300">
              Vyberte projekt…
            </div>
          );
        if (!state.allProjectDetails[state.selectedProjectId])
          return <ProjectLayoutSkeleton />;
        return (
          <RequireFeature feature={FEATURES.MODULE_PROJECTS}>
            <ProjectLayout
              projectId={state.selectedProjectId}
              projectDetails={state.allProjectDetails[state.selectedProjectId]}
              onUpdateDetails={(updates) =>
                actions.handleUpdateProjectDetails(
                  state.selectedProjectId,
                  updates,
                )
              }
              onAddCategory={(cat) =>
                actions.handleAddCategory(state.selectedProjectId, cat)
              }
              onEditCategory={(cat) =>
                actions.handleEditCategory(state.selectedProjectId, cat)
              }
              onDeleteCategory={(catId) =>
                actions.handleDeleteCategory(state.selectedProjectId, catId)
              }
              onBidsChange={actions.handleBidsChange}
              activeTab={activeProjectTab}
              onTabChange={(tab) => {
                setActiveProjectTab(tab);
                // Clear category when switching away from pipeline tab
                if (tab !== "pipeline") {
                  setActivePipelineCategoryId(null);
                }
                navigate(
                  buildAppUrl("project", {
                    projectId: state.selectedProjectId,
                    tab,
                    categoryId:
                      tab === "pipeline"
                        ? (activePipelineCategoryId ?? undefined)
                        : undefined,
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
                    projectId: state.selectedProjectId,
                    tab: "pipeline",
                    categoryId: catId,
                  }),
                );
              }}
              onCategoryNavigate={(catId) => {
                setActivePipelineCategoryId(catId);
                navigate(
                  buildAppUrl("project", {
                    projectId: state.selectedProjectId,
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
      {renderCurrentView()}

      {/* Desktop-only components */}
      {isDesktop && showWelcome && (
        <DesktopWelcome
          onClose={dismissWelcome}
          onSelectFolder={selectFolder}
        />
      )}

      {isDesktop && <UpdateBanner />}
    </MainLayout>
  );
}

export default function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}
