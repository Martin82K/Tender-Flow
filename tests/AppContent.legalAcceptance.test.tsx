import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppContent } from "@/app/AppContent";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/shared/legal/legalDocumentVersions";

const mockState = vi.hoisted(() => ({
  acceptLegalDocuments: vi.fn(),
  updatePreferences: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "user",
      subscriptionTier: "pro",
      preferences: {
        theme: "system",
        primaryColor: "#607AFB",
        backgroundColor: "#f5f6f8",
      },
      legalAcceptance: {
        termsVersion: null,
        termsAcceptedAt: null,
        privacyVersion: null,
        privacyAcceptedAt: null,
      },
    },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
    updatePreferences: mockState.updatePreferences,
    acceptLegalDocuments: mockState.acceptLegalDocuments,
  }),
}));

vi.mock("@/context/UIContext", () => ({
  useUI: () => ({
    showUiModal: vi.fn(),
    uiModal: null,
    closeUiModal: vi.fn(),
  }),
}));

vi.mock("@/hooks/useDesktop", () => ({
  useDesktop: () => ({ isDesktop: false }),
}));

vi.mock("@/hooks/useAppData", () => ({
  useAppData: () => ({
    state: {
      isDataLoading: false,
      appLoadProgress: 100,
      loadingError: null,
      selectedProjectId: null,
      projects: [],
      allProjectDetails: {},
      contacts: [],
      contactStatuses: [],
      isAdmin: false,
      isBackgroundLoading: false,
      backgroundWarning: null,
    },
    actions: {
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
  }),
}));

vi.mock("@/shared/routing/router", () => ({
  useLocation: () => ({ pathname: "/app", search: "" }),
  navigate: vi.fn(),
}));

vi.mock("@/shared/routing/routeUtils", () => ({
  buildAppUrl: vi.fn(),
}));

vi.mock("@/config/features", () => ({
  FEATURES: {
    MODULE_PROJECTS: "projects",
    MODULE_CONTACTS: "contacts",
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

vi.mock("@app/hooks/useDesktopMcpTokenSync", () => ({
  useDesktopMcpTokenSync: () => undefined,
}));

vi.mock("@app/hooks/useRouteStateSync", () => ({
  useRouteStateSync: () => undefined,
}));

vi.mock("@app/hooks/useStuckLoadingRecovery", () => ({
  useStuckLoadingRecovery: () => undefined,
}));

vi.mock("@/services/incidentLogger", () => ({
  INCIDENT_FATAL_EVENT_NAME: "incident",
  setIncidentContext: vi.fn(),
}));

vi.mock("@app/views/LazyViews", () => ({
  AppLazyFallback: () => <div>fallback</div>,
  Contacts: () => <div>contacts</div>,
  Dashboard: () => <div>dashboard</div>,
  ProjectLayout: () => <div>project</div>,
  ProjectManager: () => <div>project-manager</div>,
  ProjectOverview: () => <div>project-overview</div>,
  Settings: () => <div>settings</div>,
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.acceptLegalDocuments.mockResolvedValue(undefined);
  });

  it("po přihlášení zobrazí modal a uloží potvrzení po zaškrtnutí obou voleb", async () => {
    render(<AppContent />);

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

  it("zobrazí chybu z uložení potvrzení bez pádu UI", async () => {
    mockState.acceptLegalDocuments.mockRejectedValueOnce(
      new Error("Přihlášení vypršelo. Přihlaste se prosím znovu."),
    );

    render(<AppContent />);

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
});
