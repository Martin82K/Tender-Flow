import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectManager } from "@/features/projects/ProjectManager";
import { HelpProvider } from "@/features/help";
import { ToastProvider } from "@/features/notifications/context/ToastContext";
import type { Project } from "@/types";

const mocks = vi.hoisted(() => ({
  updateProjectMock: vi.fn(),
  onCloneMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/context/FeatureContext", () => ({
  useFeatures: () => ({
    currentPlan: "pro",
    hasFeature: () => false,
    isLoading: false,
  }),
}));

vi.mock("@/features/notifications/hooks/useNotifications", () => ({
  useNotifications: () => ({
    notifications: [],
    isLoading: false,
    unreadCount: 0,
    refresh: vi.fn().mockResolvedValue(undefined),
    markRead: vi.fn().mockResolvedValue(undefined),
    markAllRead: vi.fn().mockResolvedValue(undefined),
    dismiss: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/services/projectService", () => ({
  projectService: {
    updateProject: mocks.updateProjectMock,
    getProjectShares: vi.fn(),
    shareProject: vi.fn(),
    removeShare: vi.fn(),
    updateSharePermission: vi.fn(),
    getMyProjectAccess: vi.fn(() => new Promise(() => undefined)),
  },
}));

const renderProjectManager = (projects: Project[]) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
      <HelpProvider>
        <ProjectManager
          projects={projects}
          onAddProject={vi.fn()}
          onDeleteProject={vi.fn()}
          onCloneTenderToRealization={mocks.onCloneMock}
          onArchiveProject={vi.fn()}
        />
      </HelpProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
};

describe("ProjectManager clone to realization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mocks.onCloneMock.mockResolvedValue({ projectId: "realization-1" });
  });

  it("zobrazí tlačítko jen pro aktivní soutěž", () => {
    renderProjectManager([
      {
        id: "tender-1",
        name: "Soutěž A",
        location: "Praha",
        status: "tender",
        ownerId: "user-1",
      },
      {
        id: "real-1",
        name: "Realizace B",
        location: "Brno",
        status: "realization",
        ownerId: "user-1",
      },
      {
        id: "arch-1",
        name: "Archiv C",
        location: "Plzeň",
        status: "archived",
        ownerId: "user-1",
      },
    ]);

    expect(screen.getByTitle("Přepnout do realizace")).toBeInTheDocument();
    expect(screen.queryAllByTitle("Přepnout do realizace")).toHaveLength(1);
  });

  it("odliší stavové značky soutěže a realizace stejně jako sidebar", () => {
    renderProjectManager([
      {
        id: "tender-1",
        name: "Soutěž A",
        location: "Praha",
        status: "tender",
        ownerId: "user-1",
      },
      {
        id: "real-1",
        name: "Realizace B",
        location: "Brno",
        status: "realization",
        ownerId: "user-1",
      },
    ]);

    const tenderBadge = screen.getByLabelText("Soutěž");
    const realizationBadge = screen.getByLabelText("Realizace");

    expect(tenderBadge).toHaveAttribute("data-help-id", "pm-project-status-badge");
    expect(tenderBadge).toHaveAttribute("data-status", "tender");
    expect(tenderBadge).toHaveTextContent("V soutěži");

    expect(realizationBadge).toHaveAttribute("data-help-id", "pm-project-status-badge");
    expect(realizationBadge).toHaveAttribute("data-status", "realization");
    expect(realizationBadge).toHaveTextContent("V realizaci");
  });

  it("po potvrzení zavolá klonovací akci", async () => {
    renderProjectManager([
      {
        id: "tender-1",
        name: "Soutěž A",
        location: "Praha",
        status: "tender",
        ownerId: "user-1",
      },
    ]);

    fireEvent.click(screen.getByTitle("Přepnout do realizace"));
    expect(screen.getByText("Přepnout do realizace")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Vytvořit realizaci" }));

    await waitFor(() => {
      expect(mocks.onCloneMock).toHaveBeenCalledWith("tender-1");
    });
  });

  it("zobrazí čitelný badge sdílení s plným tooltipem", () => {
    renderProjectManager([
      {
        id: "shared-1",
        name: "Sdílená stavba",
        location: "Aš",
        status: "realization",
        ownerId: "user-1",
        sharedWith: ["cerny@baustav.cz", "lida@baustav.cz", "smcrka@baustav.cz"],
      },
    ]);

    const badge = screen.getByRole("button", {
      name: "Sdíleno s: cerny@baustav.cz, lida@baustav.cz +1",
    });

    expect(badge).toHaveAttribute("data-help-id", "pm-shared-with-badge");
    expect(badge).toHaveAttribute(
      "title",
      "Sdíleno s: cerny@baustav.cz, lida@baustav.cz, smcrka@baustav.cz",
    );
  });
});

it('filtruje portfolio a otevře stavbu přes její název', () => {
  renderProjectManager([
    { id: 'a', name: 'Alfa', location: 'Praha', status: 'tender', ownerId: 'user-1' },
    { id: 'b', name: 'Beta', location: 'Brno', status: 'realization', ownerId: 'user-1' },
  ]);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Hledat stavbu' }), { target: { value: 'Beta' } });
  expect(screen.queryByRole('link', { name: 'Alfa' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute('href', '/app/project/b?tab=overview');
});
