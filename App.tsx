import React, { Suspense, useEffect, useState } from "react";
import { AppProviders } from "./components/providers/AppProviders";
import { MainLayout } from "./components/layouts/MainLayout";
import { AuthLayout } from "./components/layouts/AuthLayout";
import { useAppData } from "./hooks/useAppData";
import { useAuth } from "./context/AuthContext";
import { useUIState } from "./hooks/useUIState";
import { useLocation, navigate } from "./components/routing/router";
import { buildAppUrl, parseAppRoute } from "./components/routing/routeUtils";
import { View } from "./types";
import { RequireFeature } from "./components/routing/RequireFeature";
import { FEATURES } from "./config/features";

// Components (Lazy)
const ProjectManager = React.lazy(() => import('./components/ProjectManager').then(m => ({ default: m.ProjectManager })));
const Dashboard = React.lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const ProjectLayout = React.lazy(() => import('./components/ProjectLayout').then(m => ({ default: m.ProjectLayout })));
const Contacts = React.lazy(() => import('./components/Contacts').then(m => ({ default: m.Contacts })));
const Settings = React.lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const ProjectOverview = React.lazy(() => import('./components/ProjectOverview').then(m => ({ default: m.ProjectOverview })));

// Auth Pages
import { LandingPage } from './components/LandingPage';
import { LoginPage } from "./components/auth/LoginPage";
import { RegisterPage } from "./components/auth/RegisterPage";
import { ForgotPasswordPage } from "./components/auth/ForgotPasswordPage";

function AppContent() {
  const { user, isAuthenticated, isLoading: authLoading, logout, updatePreferences } = useAuth();
  const { showUiModal, uiModal, closeUiModal } = useUIState();
  const { pathname, search } = useLocation();

  // Data Hook
  const { state, actions } = useAppData(showUiModal);

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [activeProjectTab, setActiveProjectTab] = useState<string>("overview");
  const [activePipelineCategoryId, setActivePipelineCategoryId] = useState<string | null>(null);

  // Sync URL to View
  useEffect(() => {
    if (!isAuthenticated) return;

    const route = parseAppRoute(pathname, search);
    if (!route.isApp) return;

    if ('redirectTo' in route) {
      navigate(route.redirectTo, { replace: true });
      return;
    }

    setCurrentView(route.view);
    if (route.view === "project") {
      if (route.projectId && route.projectId !== state.selectedProjectId) {
        actions.setSelectedProjectId(route.projectId);
      }
      if (route.tab) setActiveProjectTab(route.tab);
      if (route.categoryId) setActivePipelineCategoryId(route.categoryId);
    }
  }, [pathname, search, isAuthenticated]);

  // Theme
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "system");
  const [primaryColor, setPrimaryColor] = useState("orange");
  const [backgroundColor, setBackgroundColor] = useState("slate");

  // Scroll Restoration
  useEffect(() => {
    try {
      if (window.self !== window.top && "scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch { }
  }, []);

  // Initial Loading Screen
  const isAppPath = pathname === "/app" || pathname.startsWith("/app/");
  const shouldShowLoader = (authLoading && isAppPath) || (isAuthenticated && state.isDataLoading);

  if (shouldShowLoader) {
    const percent = state.appLoadProgress?.percent;
    const label = state.appLoadProgress?.label;
    let loadingMessage = "Načítám aplikaci...";
    if (authLoading && state.isDataLoading) loadingMessage = "Načítám aplikaci a data...";
    else if (authLoading) loadingMessage = "Ověřování přihlášení...";
    else if (state.isDataLoading) loadingMessage = "Načítám data...";

    const displayPercent = typeof percent === "number" ? percent : (authLoading ? 30 : state.isDataLoading ? 60 : 0);

    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-4 px-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <div className="w-full max-w-sm">
          <p className="text-lg font-medium mb-4">{loadingMessage}</p>
          <div className="mt-4">
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, displayPercent))}%` }} />
            </div>
            {label && <div className="mt-3 text-sm text-white/70 truncate">{label}</div>}
          </div>
        </div>
      </div>
    );
  }

  if (state.loadingError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-6 p-4 text-center">
        <div className="text-red-500 text-5xl"><span className="material-symbols-outlined text-6xl">error</span></div>
        <h1 className="text-2xl font-bold">Chyba při načítání</h1>
        <p className="text-gray-400 max-w-md">{state.loadingError}</p>
        <div className="flex gap-4">
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-primary hover:bg-primary/90 rounded-lg font-bold">Obnovit stránku</button>
          <button onClick={() => logout()} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold">Odhlásit se</button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (pathname === "/") return <LandingPage />;
    return (
      <AuthLayout>
        {pathname === "/login" && <LoginPage />}
        {pathname === "/register" && <RegisterPage />}
        {pathname === "/forgot-password" && <ForgotPasswordPage />}
        {!["/login", "/register", "/forgot-password", "/"].includes(pathname) && (
          <div className="mx-auto max-w-2xl px-4 py-16 text-center">
            <h1 className="text-2xl font-semibold text-white">Stránka nenalezena</h1>
            <button onClick={() => navigate("/", { replace: true })} className="mt-6 px-5 py-3 rounded-xl bg-orange-500 text-white font-medium">Zpět na landing</button>
          </div>
        )}
      </AuthLayout>
    );
  }

  const handleNavigateToProject = (id: string) => {
    actions.setSelectedProjectId(id);
    navigate(buildAppUrl("project", { projectId: id, tab: "overview" }));
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case "dashboard": return <Dashboard projects={state.projects} projectDetails={state.allProjectDetails} onUpdateProjectDetails={actions.handleUpdateProjectDetails} onNavigateToProject={handleNavigateToProject} />;
      case "project":
        if (!state.selectedProjectId) return <div className="flex items-center justify-center h-full text-slate-600 dark:text-slate-300">Vyberte projekt…</div>;
        if (!state.allProjectDetails[state.selectedProjectId]) return <div className="flex flex-col items-center justify-center h-full"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div><p className="mt-4 text-slate-500">Načítám detail projektu...</p></div>;
        return (
          <RequireFeature feature={FEATURES.MODULE_PROJECTS}>
            <ProjectLayout
              projectId={state.selectedProjectId}
              projectDetails={state.allProjectDetails[state.selectedProjectId]}
              onUpdateDetails={(updates) => actions.handleUpdateProjectDetails(state.selectedProjectId, updates)}
              onAddCategory={(cat) => actions.handleAddCategory(state.selectedProjectId, cat)}
              onEditCategory={(cat) => actions.handleEditCategory(state.selectedProjectId, cat)}
              onDeleteCategory={(catId) => actions.handleDeleteCategory(state.selectedProjectId, catId)}
              onBidsChange={actions.handleBidsChange}
              activeTab={activeProjectTab}
              onTabChange={(tab) => {
                setActiveProjectTab(tab);
                navigate(buildAppUrl("project", { projectId: state.selectedProjectId, tab, categoryId: activePipelineCategoryId ?? undefined }), { replace: true });
              }}
              contacts={state.contacts}
              statuses={state.contactStatuses}
              initialPipelineCategoryId={activePipelineCategoryId ?? undefined}
              onNavigateToPipeline={(catId) => {
                setActiveProjectTab("pipeline");
                setActivePipelineCategoryId(catId);
                navigate(buildAppUrl("project", { projectId: state.selectedProjectId, tab: "pipeline", categoryId: catId }), { replace: true });
              }}
            />
          </RequireFeature>
        );
      case "contacts":
        return <RequireFeature feature={FEATURES.MODULE_CONTACTS}><Contacts statuses={state.contactStatuses} contacts={state.contacts} onContactsChange={actions.setContacts} onAddContact={actions.handleAddContact} onUpdateContact={actions.handleUpdateContact} onBulkUpdateContacts={actions.handleBulkUpdateContacts} onDeleteContacts={actions.handleDeleteContacts} isAdmin={state.isAdmin} /></RequireFeature>;
      case "settings":
        return <Settings theme={theme} onSetTheme={(t) => { setTheme(t); localStorage.setItem('theme', t); localStorage.removeItem('darkMode'); if (user) updatePreferences({ theme: t }); }} primaryColor={primaryColor} onSetPrimaryColor={(c) => { setPrimaryColor(c); if (user) updatePreferences({ primaryColor: c }); }} backgroundColor={backgroundColor} onSetBackgroundColor={(c) => { setBackgroundColor(c); if (user) updatePreferences({ backgroundColor: c }); }} contactStatuses={state.contactStatuses} onUpdateStatuses={actions.setContactStatuses} onImportContacts={actions.handleImportContacts} onDeleteContacts={actions.handleDeleteContacts} contacts={state.contacts} isAdmin={state.isAdmin} onSaveSettings={async () => { }} user={user} />;
      case "project-management":
        return <ProjectManager projects={state.projects} onAddProject={actions.handleAddProject} onDeleteProject={actions.handleDeleteProject} onArchiveProject={actions.handleArchiveProject} />;
      case "project-overview":
        return <RequireFeature feature={FEATURES.FEATURE_ADVANCED_REPORTING}><ProjectOverview projects={state.projects} projectDetails={state.allProjectDetails} /></RequireFeature>;
      default: return <Dashboard projects={state.projects} projectDetails={state.allProjectDetails} onUpdateProjectDetails={actions.handleUpdateProjectDetails} onNavigateToProject={handleNavigateToProject} />;
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
