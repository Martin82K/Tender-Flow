import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { navigate } from '@/shared/routing/router';
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
    expect(screen.getByTitle("Přepnout do realizace")).toHaveTextContent("Přepnout do realizace");
    expect(screen.getAllByTitle("Upravit projekt")[0]).toHaveTextContent("Upravit stavbu");
    expect(screen.getAllByTitle("Odstranit")[0]).toHaveTextContent("Odstranit stavbu");
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
    expect(screen.getByRole("heading", { name: "Přepnout do realizace" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Vytvořit realizaci" }));

    await waitFor(() => {
      expect(mocks.onCloneMock).toHaveBeenCalledWith("tender-1");
    });
  });

  it("nezobrazuje seznam členů týmu v nabídce stavby", () => {
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

    expect(screen.queryByText(/^Sdíleno s:/)).not.toBeInTheDocument();
    expect(screen.getByTitle("Sdílet projekt")).toHaveTextContent("Sdílet stavbu");
  });
});

it.each(['search', 'owner'])('restores the latest scroll after changing the %s filter', (filter) => {
  sessionStorage.clear();
  act(() => navigate('/app/projects'));
  const projects: Project[] = [
    { id: 'a', name: 'Alfa', location: 'Praha', status: 'tender', ownerId: 'user-1' },
  ];
  const view = renderProjectManager(projects);
  const scroller = view.container.querySelector('.tf-project-manager-view') as HTMLDivElement;
  fireEvent.scroll(scroller, { target: { scrollTop: 240 } });
  if (filter === 'search') {
    fireEvent.change(screen.getByRole('searchbox', { name: 'Hledat stavbu' }), { target: { value: 'Alfa' } });
  } else {
    fireEvent.click(screen.getByRole('checkbox', { name: 'Moje stavby' }));
  }
  view.unmount();
  const restored = renderProjectManager(projects);
  try {
    expect(restored.container.querySelector('.tf-project-manager-view')?.scrollTop).toBe(240);
  } finally { restored.unmount(); act(() => navigate('/')); sessionStorage.clear(); }
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

it('switches portfolio views through the URL and keeps archive search separate from active projects', () => {
  sessionStorage.clear();
  act(() => navigate('/app/projects?status=archived'));
  const view = renderProjectManager([
    { id: 'a', name: 'Aktivní škola', location: 'Praha', status: 'tender', ownerId: 'user-1' },
    { id: 'b', name: 'Archivní škola', location: 'Brno', status: 'archived', ownerId: 'user-1' },
    { id: 'c', name: 'Archivní most', location: 'Praha', status: 'archived', ownerId: 'user-2' },
  ]);
  try {
    expect(screen.queryByRole('link', { name: 'Aktivní škola' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Archivní škola' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Stav staveb' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Hledat stavbu' }), { target: { value: 'škola' } });
    expect(screen.queryByRole('link', { name: 'Archivní most' })).not.toBeInTheDocument();
    act(() => navigate('/app/projects?status=tender'));
    expect(screen.getByRole('link', { name: 'Aktivní škola' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Archivní škola' })).not.toBeInTheDocument();
    act(() => navigate('/app/projects'));
    expect(screen.getByRole('link', { name: 'Aktivní škola' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Hledat stavbu' })).toHaveValue('škola');
  } finally { view.unmount(); act(() => navigate('/')); sessionStorage.clear(); }
});
