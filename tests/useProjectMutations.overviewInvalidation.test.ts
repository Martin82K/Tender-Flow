import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveArchiveProjectUpdate,
  useAddCategoryMutation,
  useAddProjectMutation,
  useCloneTenderToRealizationMutation,
  useArchiveProjectMutation,
  useDeleteCategoryMutation,
  useDeleteProjectMutation,
  useEditCategoryMutation,
  useUpdateProjectDetailsMutation,
} from "../hooks/mutations/useProjectMutations";
import { OVERVIEW_TENANT_DATA_KEY } from "../hooks/queries/useOverviewTenantDataQuery";
import { PROJECT_DETAILS_KEYS } from "../hooks/queries/useProjectDetailsQuery";

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcRestMock: vi.fn(),
  invokeAuthedFunctionMock: vi.fn(),
  ensureStructureMock: vi.fn(),
  getDemoDataMock: vi.fn(),
  saveDemoDataMock: vi.fn(),
  emitCategoryStatusNotificationMock: vi.fn(),
  emitProjectClonedNotificationMock: vi.fn(),
  emitProjectArchivedNotificationMock: vi.fn(),
}));

vi.mock("../services/dbAdapter", () => ({
  dbAdapter: {
    from: mocks.fromMock,
    rpcRest: mocks.rpcRestMock,
  },
}));

vi.mock("../services/functionsClient", () => ({
  invokeAuthedFunction: mocks.invokeAuthedFunctionMock,
}));

vi.mock("../services/fileSystemService", () => ({
  ensureStructure: mocks.ensureStructureMock,
}));

vi.mock("../utils/docHub", () => ({
  buildHierarchyTree: vi.fn(() => []),
  ensureExtraHierarchy: vi.fn((value) => value || []),
  resolveDocHubStructureV1: vi.fn(() => ({ extraHierarchy: [] })),
}));

vi.mock("../services/demoData", () => ({
  DEMO_PROJECT: { id: "demo-project-1" },
  DEMO_PROJECT_DETAILS: {
    id: "demo-project-1",
    title: "Demo",
    location: "",
    finishDate: "",
    siteManager: "",
    categories: [],
    bids: {},
  },
  getDemoData: mocks.getDemoDataMock,
  isDemoSession: vi.fn(() => false),
  saveDemoData: mocks.saveDemoDataMock,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", role: "user" },
  }),
}));

vi.mock("@features/notifications/api/notificationEmitter", () => ({
  emitCategoryStatusNotification: mocks.emitCategoryStatusNotificationMock,
  emitProjectClonedNotification: mocks.emitProjectClonedNotificationMock,
  emitProjectArchivedNotification: mocks.emitProjectArchivedNotificationMock,
}));

const createThenableChain = (
  response: { data: null; error: null | { code?: string; message?: string } } = {
    data: null,
    error: null,
  },
) => {
  const chain: any = {};
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.match = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => chain);
  chain.single = vi.fn(() => chain);
  chain.then = (
    resolve: (value: {
      data: null;
      error: null | { code?: string; message?: string };
    }) => unknown,
  ) => Promise.resolve(resolve(response));
  chain.catch = () => chain;
  return chain;
};

const createFromResult = (
  response: { data: null; error: null | { code?: string; message?: string } } = {
    data: null,
    error: null,
  },
) => {
  const chain = createThenableChain(response);
  return {
    insert: vi.fn((_payload: unknown) => chain),
    update: vi.fn((_payload: unknown) => chain),
    delete: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    select: vi.fn(() => chain),
  };
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { queryClient, wrapper, invalidateSpy };
};

const expectOverviewInvalidation = (
  invalidateSpy: ReturnType<typeof vi.spyOn>,
) => {
  const found = invalidateSpy.mock.calls.some((call) => {
    const arg = call[0] as { queryKey?: unknown[] } | undefined;
    return JSON.stringify(arg?.queryKey) === JSON.stringify(OVERVIEW_TENANT_DATA_KEY);
  });

  expect(found).toBe(true);
};

describe("useProjectMutations -> overview cache invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fromMock.mockImplementation(() => createFromResult());
    mocks.rpcRestMock.mockResolvedValue({ data: [{ project_id: "realization-1" }], error: null });
    mocks.invokeAuthedFunctionMock.mockResolvedValue(undefined);
    mocks.ensureStructureMock.mockResolvedValue({ success: true });
    mocks.getDemoDataMock.mockReturnValue(null);
    mocks.emitCategoryStatusNotificationMock.mockResolvedValue(null);
    mocks.emitProjectClonedNotificationMock.mockResolvedValue(null);
    mocks.emitProjectArchivedNotificationMock.mockResolvedValue(null);
  });

  it("invaliduje overview cache po vytvoření projektu", async () => {
    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useAddProjectMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: "p-1",
        name: "Projekt 1",
        location: "Praha",
        status: "tender",
      });
    });

    expectOverviewInvalidation(invalidateSpy);
  });

  it("invaliduje overview cache po smazání projektu", async () => {
    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useDeleteProjectMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("p-1");
    });

    expectOverviewInvalidation(invalidateSpy);
  });

  it("invaliduje overview cache po změně statusu projektu", async () => {
    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useArchiveProjectMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: "p-1",
        currentStatus: "tender",
        archivedOriginalStatus: null,
      });
    });

    expectOverviewInvalidation(invalidateSpy);
  });

  it("při archivaci ukládá původní aktivní status projektu", async () => {
    const fromResult = createFromResult();
    mocks.fromMock.mockReturnValueOnce(fromResult);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useArchiveProjectMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: "p-archive",
        currentStatus: "tender",
        archivedOriginalStatus: null,
      });
    });

    expect(fromResult.update).toHaveBeenCalledWith({
      status: "archived",
      archived_original_status: "tender",
    });
  });

  it("při obnově z archivu vrací uložený původní status", async () => {
    const fromResult = createFromResult();
    mocks.fromMock.mockReturnValueOnce(fromResult);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useArchiveProjectMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: "p-restore",
        currentStatus: "archived",
        archivedOriginalStatus: "tender",
      });
    });

    expect(fromResult.update).toHaveBeenCalledWith({
      status: "tender",
      archived_original_status: null,
    });
  });

  it("invaliduje overview cache po klonování soutěže do realizace", async () => {
    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useCloneTenderToRealizationMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync("p-1");
    });

    expect(mocks.rpcRestMock).toHaveBeenCalledWith(
      "clone_tender_project_to_realization",
      { project_id_input: "p-1" },
    );
    expectOverviewInvalidation(invalidateSpy);
  });

  it("invaliduje overview cache po update detailu projektu", async () => {
    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useUpdateProjectDetailsMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: "p-1",
        updates: {},
      });
    });

    expectOverviewInvalidation(invalidateSpy);
  });

  it("invaliduje overview cache po přidání kategorie a neukládá lokální přílohu do Supabase", async () => {
    const { wrapper, invalidateSpy } = createWrapper();
    const fromResult = createFromResult();
    mocks.fromMock.mockReturnValue(fromResult);
    const { result } = renderHook(() => useAddCategoryMutation(), { wrapper });
    const budgetAttachment = {
      source: "dochub" as const,
      fileName: "rozpocet.xlsx",
      relativePath: "rozpocet.xlsx",
      selectedAt: "2026-07-01T20:00:00.000Z",
      enabled: true,
    };

    await act(async () => {
      await result.current.mutateAsync({
        projectId: "p-1",
        category: {
          id: "cat-1",
          title: "Elektro",
          budget: "100 000 Kč",
          sodBudget: 120000,
          planBudget: 110000,
          status: "open",
          subcontractorCount: 0,
          description: "",
          budgetAttachment,
        },
      });
    });

    const [insertPayload] = fromResult.insert.mock.calls[0];
    expect(insertPayload).not.toHaveProperty("budget_attachment");
    expectOverviewInvalidation(invalidateSpy);
  });

  it("před dokončením vytvoření kategorie počká na lokální DocHub strukturu", async () => {
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(PROJECT_DETAILS_KEYS.detail("p-1"), {
      id: "p-1",
      title: "Projekt",
      location: "",
      categories: [],
      docHubEnabled: true,
      docHubProvider: "onedrive",
      docHubRootLink: "/Projects/Stavba",
    });
    let finishEnsure: ((value: { success: boolean }) => void) | undefined;
    mocks.ensureStructureMock.mockReturnValue(new Promise((resolve) => {
      finishEnsure = resolve;
    }));
    const { result } = renderHook(() => useAddCategoryMutation(), { wrapper });
    let mutationFinished = false;

    await act(async () => {
      const mutationPromise = result.current.mutateAsync({
        projectId: "p-1",
        category: {
          id: "cat-1",
          title: "Betony",
          budget: "0 Kč",
          sodBudget: 0,
          planBudget: 0,
          status: "open",
          subcontractorCount: 0,
          description: "",
        },
      }).then(() => {
        mutationFinished = true;
      });

      await vi.waitFor(() => expect(mocks.ensureStructureMock).toHaveBeenCalled());
      expect(mutationFinished).toBe(false);
      finishEnsure?.({ success: true });
      await mutationPromise;
    });
    expect(mutationFinished).toBe(true);
  });

  it("invaliduje overview cache po úpravě kategorie a neukládá lokální přílohu do Supabase", async () => {
    const { wrapper, invalidateSpy } = createWrapper();
    const fromResult = createFromResult();
    mocks.fromMock.mockReturnValue(fromResult);
    const { result } = renderHook(() => useEditCategoryMutation(), { wrapper });
    const budgetAttachment = {
      source: "dochub" as const,
      fileName: "rozpocet.xlsx",
      relativePath: "rozpocet.xlsx",
      selectedAt: "2026-07-01T20:00:00.000Z",
      enabled: true,
    };

    await act(async () => {
      await result.current.mutateAsync({
        projectId: "p-1",
        category: {
          id: "cat-1",
          title: "Elektro update",
          budget: "100 000 Kč",
          sodBudget: 120000,
          planBudget: 110000,
          status: "open",
          subcontractorCount: 0,
          description: "",
          budgetAttachment,
        },
      });
    });

    const [updatePayload] = fromResult.update.mock.calls[0];
    expect(updatePayload).not.toHaveProperty("budget_attachment");
    expectOverviewInvalidation(invalidateSpy);
  });

  it("invaliduje overview cache po smazání kategorie", async () => {
    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useDeleteCategoryMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        projectId: "p-1",
        categoryId: "cat-1",
      });
    });

    expectOverviewInvalidation(invalidateSpy);
  });
});

describe("resolveArchiveProjectUpdate", () => {
  it("při obnově bez uloženého statusu bezpečně fallbackne na realizaci", () => {
    expect(
      resolveArchiveProjectUpdate({
        currentStatus: "archived",
        archivedOriginalStatus: null,
      }),
    ).toEqual({
      targetStatus: "realization",
      archivedOriginalStatus: null,
    });
  });
});
