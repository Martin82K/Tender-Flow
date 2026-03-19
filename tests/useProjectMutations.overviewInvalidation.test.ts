import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
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

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcRestMock: vi.fn(),
  invokeAuthedFunctionMock: vi.fn(),
  ensureStructureMock: vi.fn(),
  getDemoDataMock: vi.fn(),
  saveDemoDataMock: vi.fn(),
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
  resolveDocHubStructureV1: vi.fn(() => ({ extraHierarchy: [] })),
}));

vi.mock("../services/demoData", () => ({
  getDemoData: mocks.getDemoDataMock,
  saveDemoData: mocks.saveDemoDataMock,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", role: "user" },
  }),
}));

const createThenableChain = () => {
  const chain: any = {};
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.match = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => chain);
  chain.single = vi.fn(() => chain);
  chain.then = (resolve: (value: { data: null; error: null }) => unknown) =>
    Promise.resolve(resolve({ data: null, error: null }));
  chain.catch = () => chain;
  return chain;
};

const createFromResult = () => {
  const chain = createThenableChain();
  return {
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
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

  return { wrapper, invalidateSpy };
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
        newStatus: "archived",
      });
    });

    expectOverviewInvalidation(invalidateSpy);
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

  it("invaliduje overview cache po přidání kategorie", async () => {
    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useAddCategoryMutation(), { wrapper });

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
        },
      });
    });

    expectOverviewInvalidation(invalidateSpy);
  });

  it("invaliduje overview cache po úpravě kategorie", async () => {
    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useEditCategoryMutation(), { wrapper });

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
        },
      });
    });

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
