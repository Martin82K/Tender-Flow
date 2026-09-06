import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppContent } from "@/app/AppContent";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/shared/legal/legalDocumentVersions";

const mockState = vi.hoisted(() => ({
  acceptLegalDocuments: vi.fn(),
  updatePreferences: vi.fn(),
  logout: vi.fn(),
  showUiModal: vi.fn(),
  navigate: vi.fn(),
  appDataOverrides: {} as Record<string, unknown>,
  retrySelectedProjectDetails: vi.fn(),
  currentPlan: "pro",
  isDesktop: false,
  pathname: "/app",
  search: "",
  legalAcceptance: null as {
    termsVersion: string | null;
    termsAcceptedAt: string | null;
    privacyVersion: string | null;
    privacyAcceptedAt: string | null;
  } | null,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "user",
      subscriptionTier: mockState.currentPlan,
      preferences: {
        theme: "system",
        primaryColor: "#607AFB",
        backgroundColor: "#f5f6f8",
      },
      legalAcceptance: mockState.legalAcceptance,
    },
    isAuthenticated: true,
    isLoading: false,
    logout: mockState.logout,
    updatePreferences: mockState.updatePreferences,
    acceptLegalDocuments: mockState.acceptLegalDocuments,
  }),
}));

vi.mock("@/context/UIContext", () => ({
  useUI: () => ({
    showUiModal: mockState.showUiModal,
    uiModal: null,
    closeUiModal: vi.fn(),
  }),
}));

vi.mock("@/context/FeatureContext", () => ({
  useFeatures: () => ({
    currentPlan: mockState.currentPlan,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useDesktop", () => ({
  useDesktop: () => ({ isDesktop: mockState.isDesktop }),
}));

vi.mock("@/hooks/useAppData", () => ({
  useAppData: () => ({
    state: {
      isDataLoading: false,
      appLoadProgress: 100,
      loadingError: null,
      loadingErrorDiagnostic: null,
      selectedProjectId: null,
      projects: [],
      allProjectDetails: {},
      contacts: [],
      contactStatuses: [],
      isAdmin: false,
      isBackgroundLoading: false,
      backgroundWarning: null,
      ...mockState.appDataOverrides,
    },
    actions: {
      retrySelectedProjectDetails: mockState.retrySelectedProjectDetails,
      setSelectedProjectId: vi.fn(),
      handleUpdateProjectDetails: vi.fn(),
      handleAddCategory: vi.fn(),
      handleEditCategory: vi.fn(),
      handleDeleteCategory: vi.fn(),
      handleBidsChange: vi.fn(),
      handleUpdateContact: vi.fn(),
      setContacts: vi.fn(),
      handleAddContact: vi.fn(),
      handleBulkUpdateContacts: vi.fn(),
      handleDeleteContacts: vi.fn(),
      handleImportContacts: vi.fn(),
      setContactStatuses: vi.fn(),
      handleAddProject: vi.fn(),
      handleDeleteProject: vi.fn(),
      handleArchiveProject: vi.fn(),
      loadInitialData: vi.fn(),
      setBackgroundWarning: vi.fn(),
    },
  }),
}));

vi.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    theme: "system",
    setTheme: vi.fn(),
    primaryColor: "#607AFB",
    setPrimaryColor: vi.fn(),
    uiScale: 1,
    setUiScale: vi.fn(),
    resetUiScale: vi.fn(),
  }),
}));

vi.mock("@/shared/routing/router", () => ({
  useLocation: () => ({ pathname: mockState.pathname, search: mockState.search }),
  navigate: mockState.navigate,
}));

vi.mock("@/shared/routing/routeUtils", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/shared/routing/routeUtils")>(),
  DEFAULT_APP_VIEW: "todo",
}));

vi.mock("@/config/features", () => ({
  FEATURES: {
    MODULE_PROJECTS: "projects",
    MODULE_CONTACTS: "contacts",
    MODULE_TASKS: "tasks",
    FEATURE_ADVANCED_REPORTING: "reporting",
    URL_SHORTENER: "shortener",
  },
}));

vi.mock("@/shared/routing/RequireFeature", () => ({
  RequireFeature: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/shared/routing/ShortUrlRedirect", () => ({
  ShortUrlRedirect: () => <div>short</div>,
}));

vi.mock("@/components/layouts/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/desktop", () => ({
  UpdateBanner: () => null,
}));

vi.mock("@app/hooks/useRouteStateSync", () => ({
  useRouteStateSync: ({ setCurrentView }: { setCurrentView: (view: string) => void }) => {
    React.useEffect(() => {
      if (mockState.pathname.startsWith("/app/project/")) setCurrentView("project");
    }, [setCurrentView]);
  },
}));

vi.mock("@app/hooks/useStuckLoadingRecovery", () => ({
  useStuckLoadingRecovery: () => undefined,
}));

vi.mock("@/services/incidentLogger", () => ({
  INCIDENT_FATAL_EVENT_NAME: "incident",
  logIncident: vi.fn().mockResolvedValue({ incidentId: "INC-LOAD-1" }),
  setIncidentContext: vi.fn(),
}));

vi.mock("@app/views/LazyViews", () => ({
  AppLazyFallback: () => <div>fallback</div>,
  Contacts: () => <div>contacts</div>,
  ProjectLayout: () => <div>project</div>,
  ProjectManager: () => <div>project-manager</div>,
  ProjectOverview: () => <div>project-overview</div>,
  Settings: () => <div>settings</div>,
  TasksPage: ({ initialTaskId, onCloseInitialTask }: { initialTaskId?: string; onCloseInitialTask?: () => void }) => <div>todo<span data-testid="linked-task">{initialTaskId}</span><button onClick={onCloseInitialTask}>close linked task</button></div>,
  UrlShortener: () => <div>shortener</div>,
}));

vi.mock("@app/views/LegalPageRouter", () => ({
  getLegalPage: () => null,
}));

vi.mock("@app/views/AuthGate", () => ({
  AuthGate: () => <div>auth-gate</div>,
}));

vi.mock("@app/views/AppLoadErrorView", () => ({
  AppLoadErrorView: () => <div>error</div>,
}));

vi.mock("@app/views/AppLoadingView", () => ({
  AppLoadingView: () => <div>loading</div>,
}));

describe("AppContent legal acceptance gate", () => {
  const renderAppContent = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    return render(<AppContent />, {
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.appDataOverrides = {};
    mockState.currentPlan = "pro";
    mockState.isDesktop = false;
    mockState.pathname = "/app";
    mockState.search = "";
    mockState.legalAcceptance = null;
    mockState.acceptLegalDocuments.mockResolvedValue(undefined);
  });

  it("po přihlášení zobrazí modal a uloží potvrzení po zaškrtnutí obou voleb", async () => {
    renderAppContent();

    expect(
      screen.getByText("Potvrzení podmínek a ochrany osobních údajů"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/přijímám podmínky používání aplikace/i));
    fireEvent.click(
      screen.getByLabelText(/byl\(a\) informován\(a\) o zpracování osobních údajů/i),
    );
    fireEvent.click(screen.getByRole("button", { name: "Potvrdit a pokračovat" }));

    await waitFor(() => {
      expect(mockState.acceptLegalDocuments).toHaveBeenCalledWith({
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
      });
    });
  });

  it("passes the task deep link into TODO and clears it on explicit close", () => {
    mockState.pathname = "/app/todo";
    mockState.search = "?taskId=task-42";
    renderAppContent();
    expect(screen.getByTestId("linked-task")).toHaveTextContent("task-42");
    fireEvent.click(screen.getByRole("button", { name: "close linked task" }));
    expect(mockState.navigate).toHaveBeenCalledWith("/app/todo");
  });

  it("zobrazí chybu z uložení potvrzení bez pádu UI", async () => {
    mockState.acceptLegalDocuments.mockRejectedValueOnce(
      new Error("Přihlášení vypršelo. Přihlaste se prosím znovu."),
    );

    renderAppContent();

    fireEvent.click(screen.getByLabelText(/přijímám podmínky používání aplikace/i));
    fireEvent.click(
      screen.getByLabelText(/byl\(a\) informován\(a\) o zpracování osobních údajů/i),
    );
    fireEvent.click(screen.getByRole("button", { name: "Potvrdit a pokračovat" }));

    await waitFor(() => {
      expect(
        screen.getByText("Přihlášení vypršelo. Přihlaste se prosím znovu."),
      ).toBeInTheDocument();
    });
  });

  it("blokuje desktop aplikaci pro tarif pro a zobrazuje Enterprise-only text", () => {
    mockState.isDesktop = true;
    mockState.currentPlan = "pro";
    mockState.legalAcceptance = {
      termsVersion: CURRENT_TERMS_VERSION,
      termsAcceptedAt: "2026-06-02T10:00:00.000Z",
      privacyVersion: CURRENT_PRIVACY_VERSION,
      privacyAcceptedAt: "2026-06-02T10:00:00.000Z",
    };

    renderAppContent();

    expect(
      screen.getByText(/Desktop aplikace je dostupná pouze pro Enterprise účty/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/PRO a vyšší/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Otevřít webovou aplikaci" }),
    ).toBeInTheDocument();
  });

  it("pustí desktop aplikaci pro tarif enterprise", () => {
    mockState.isDesktop = true;
    mockState.currentPlan = "enterprise";
    mockState.legalAcceptance = {
      termsVersion: CURRENT_TERMS_VERSION,
      termsAcceptedAt: "2026-06-02T10:00:00.000Z",
      privacyVersion: CURRENT_PRIVACY_VERSION,
      privacyAcceptedAt: "2026-06-02T10:00:00.000Z",
    };

    renderAppContent();

    expect(
      screen.queryByText(/Desktop aplikace je dostupná pouze pro Enterprise účty/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("todo")).toBeInTheDocument();
  });

  it("zobrazí technický kód i incident id u fatální chyby", async () => {
    mockState.legalAcceptance = {
      termsVersion: CURRENT_TERMS_VERSION,
      termsAcceptedAt: "2026-06-02T10:00:00.000Z",
      privacyVersion: CURRENT_PRIVACY_VERSION,
      privacyAcceptedAt: "2026-06-02T10:00:00.000Z",
    };
    renderAppContent();

    fireEvent(
      window,
      new CustomEvent("incident", {
        detail: {
          errorCode: "WINDOW_ERROR",
          incidentId: "INC-FATAL-1",
          message: "Internal detail",
        },
      }),
    );

    await waitFor(() => {
      expect(mockState.showUiModal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Došlo k chybě",
          message: expect.stringContaining("Kód chyby: WINDOW_ERROR"),
          confirmLabel: "Kopírovat referenci",
        }),
      );
    });
    expect(mockState.showUiModal.mock.calls.at(-1)?.[0].message).toContain(
      "Kód incidentu: INC-FATAL-1",
    );
  });

  const openProject = (overrides: Record<string, unknown> = {}) => {
    mockState.pathname = "/app/project/project-1";
    mockState.legalAcceptance = {
      termsVersion: CURRENT_TERMS_VERSION,
      termsAcceptedAt: "2026-06-02T10:00:00.000Z",
      privacyVersion: CURRENT_PRIVACY_VERSION,
      privacyAcceptedAt: "2026-06-02T10:00:00.000Z",
    };
    mockState.appDataOverrides = {
      selectedProjectId: "project-1",
      selectedProjectDetailsStatus: "error",
      isSelectedProjectDetailsFetching: false,
      canRetrySelectedProjectDetails: true,
      ...overrides,
    };
    return renderAppContent();
  };

  it("renders a project load error with a scoped retry instead of a skeleton", () => {
    openProject();
    expect(screen.getByRole("alert")).toHaveTextContent("Detail projektu se nepodařilo načíst");
    expect(screen.queryByText("fallback")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zkusit znovu" }));
    expect(mockState.retrySelectedProjectDetails).toHaveBeenCalledOnce();
  });

  it("renders an unavailable project without displaying cached project data", () => {
    openProject({
      selectedProjectDetailsStatus: "unavailable",
      canRetrySelectedProjectDetails: false,
      allProjectDetails: { "project-1": { id: "project-1", title: "Private project" } },
    });
    expect(screen.getByText("Projekt není dostupný")).toBeInTheDocument();
    expect(screen.queryByText("project")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zkusit znovu" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zpět na projekty" }));
    expect(mockState.navigate).toHaveBeenCalledWith("/app/projects");
  });

  it("renders the project skeleton only while the detail is loading", () => {
    openProject({ selectedProjectDetailsStatus: "loading" });
    expect(screen.getByText("fallback")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("disables retry while its request is running and keeps navigation available", () => {
    openProject({ isSelectedProjectDetailsFetching: true });
    expect(screen.getByRole("button", { name: "Načítání…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zpět na projekty" })).toBeEnabled();
  });

  it("renders the detail after a successful retry", () => {
    const view = openProject();
    mockState.appDataOverrides = {
      ...mockState.appDataOverrides,
      selectedProjectDetailsStatus: "ready",
      allProjectDetails: { "project-1": { id: "project-1", title: "Project" } },
    };
    view.rerender(<AppContent />);
    expect(screen.getByText("project")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

});
