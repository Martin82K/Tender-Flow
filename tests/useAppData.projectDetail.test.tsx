import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/types";

const mocks = vi.hoisted(() => ({
  projects: [{ id: "project-1" }, { id: "project-2" }] as Project[],
  projectsLoading: false,
  projectsError: null as Error | null,
  projectsRefetch: vi.fn(),
  addCategory: vi.fn().mockResolvedValue(undefined),
  getPlans: vi.fn(),
  from: vi.fn(),
  writeBid: vi.fn(),
  onRealtimeBid: undefined as ((id: string | null) => void) | undefined,
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/hooks/queries/useProjectsQuery", () => ({
  useProjectsQuery: () => ({ data: mocks.projects, isLoading: mocks.projectsLoading, error: mocks.projectsError, refetch: mocks.projectsRefetch }),
}));
vi.mock("@/hooks/queries/useContactsQuery", () => ({
  useContactsQuery: () => ({ data: [], isLoading: false }), CONTACT_KEYS: {},
}));
vi.mock("@/hooks/queries/useContactStatusesQuery", () => ({
  useContactStatusesQuery: () => ({ data: [], isLoading: false }), STATUS_KEYS: {},
}));
vi.mock("@/hooks/mutations/useProjectMutations", () => ({
  useAddProjectMutation: () => ({}), useCloneTenderToRealizationMutation: () => ({}),
  useDeleteProjectMutation: () => ({}), useArchiveProjectMutation: () => ({}),
  useUpdateProjectDetailsMutation: () => ({}), useAddCategoryMutation: () => ({ mutateAsync: mocks.addCategory }),
  useEditCategoryMutation: () => ({}), useDeleteCategoryMutation: () => ({}),
}));
vi.mock("@/hooks/mutations/useContactMutations", () => ({
  useAddContactMutation: () => ({}), useUpdateContactMutation: () => ({}),
  useDeleteContactsMutation: () => ({}), useBulkUpdateContactsMutation: () => ({}),
  useImportContactsMutation: () => ({}),
}));
vi.mock("@/services/contactsImportService", () => ({ syncContactsFromUrl: vi.fn() }));
vi.mock("@/infra/usage/appUsageService", () => ({ recordUsageAction: vi.fn() }));
vi.mock("@features/projects/api/categoryPlanRecoveryApi", () => ({ synchronizeCategoryPlan: mocks.getPlans }));
vi.mock("@/features/projects/api", () => ({ getTenderPlans: mocks.getPlans, createTenderPlanId: () => "tp1", createTenderPlan: vi.fn(), linkTenderPlanToCategory: vi.fn() }));
vi.mock("@features/projects/api/projectBidRealtimeApi", () => ({ projectBidRealtimeApi: {
  subscribeToBidUpdates: ({ onBidUpdated }: { onBidUpdated: (id: string | null) => void }) => {
    mocks.onRealtimeBid = onBidUpdated;
    return () => { mocks.onRealtimeBid = undefined; };
  },
} }));
vi.mock("@/infra/projects/pipelineRepository", () => ({ pipelineRepository: {
  updateBid: mocks.writeBid, updateBidStatus: mocks.writeBid, updateBidContracted: mocks.writeBid,
  insertBids: mocks.writeBid, deleteBid: mocks.writeBid,
} }));
vi.mock("@infra/db/dbAdapter", () => ({ dbAdapter: { from: mocks.from } }));
vi.mock("@features/projects/api/projectDemoDataApi", () => ({
  projectDemoDataApi: { isDemoSession: () => false, isDemoProjectId: () => false },
}));
vi.mock("@features/projects/model/budgetAttachmentLocalStore", () => ({
  applyLocalBudgetAttachments: (_id: string, categories: unknown[]) => categories,
}));

import { useAppData } from "@/hooks/useAppData";
import { useProjectBidRealtimeSync } from "@features/projects/hooks/useProjectBidRealtimeSync";
import { updateBid, updateBidStatus, updateBidContracted, insertBids, deleteBid } from "@features/projects/api/pipelineApi";

type Response = { data: unknown; error: unknown };
const database = (respond: (table: string, id: string) => Response | Promise<Response>) => {
  mocks.from.mockImplementation((table: string) => ({
    select: () => ({
      eq: (_column: string, id: string) => {
        const response = Promise.resolve(respond(table, id));
        return { single: () => response, maybeSingle: () => response,
          order: () => response, then: response.then.bind(response) };
      },
    }),
  }));
};
const success = (table: string, id: string): Response => ({
  data: table === "projects" ? { id, name: id, status: "realization" } : [], error: null,
});
const setup = (openProject = true) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(({ active, routeId }: { active: boolean; routeId?: string }) => useAppData(vi.fn(), active, routeId), { wrapper, initialProps: { active: openProject } });
  if (openProject) act(() => hook.result.current.actions.setSelectedProjectId("project-1"));
  return { ...hook, client, wrapper };
};

describe("useAppData project detail recovery", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.projects = [{ id: "project-1" }, { id: "project-2" }] as Project[];
    mocks.projectsLoading = false;
    mocks.projectsError = null;
    mocks.projectsRefetch.mockReset();
  });

  it("starts TODO without requesting project details and fetches only the opened project", async () => {
    const requests: string[] = [];
    database((table, id) => { if (table === "projects") requests.push(id); return success(table, id); });
    const { result, rerender, client } = setup(false);
    expect(result.current.state.isDataLoading).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
    act(() => result.current.actions.setSelectedProjectId("project-2"));
    expect(mocks.from).not.toHaveBeenCalled();
    rerender({ active: true });
    await waitFor(() => expect(result.current.state.selectedProjectDetailsStatus).toBe("ready"));
    expect(requests).toEqual(["project-2"]);
    rerender({ active: false });
    expect(result.current.state.allProjectDetails["project-2"]).toBeDefined();
    await act(async () => { await client.invalidateQueries({ queryKey: ["projectDetails"] }); });
    expect(requests).toEqual(["project-2"]);
  });

  it("does not refetch the previous selection while route state catches up to another project", async () => {
    const requests: string[] = [];
    database((table, id) => { if (table === "projects") requests.push(id); return success(table, id); });
    const { result, rerender, client } = setup();
    await waitFor(() => expect(result.current.state.selectedProjectDetailsStatus).toBe("ready"));
    rerender({ active: false });
    await act(async () => { await client.invalidateQueries({ queryKey: ["projectDetails"] }); });
    rerender({ active: true, routeId: "project-2" });
    expect(requests).toEqual(["project-1"]);
    act(() => result.current.actions.setSelectedProjectId("project-2"));
    await waitFor(() => expect(result.current.state.selectedProjectDetailsStatus).toBe("ready"));
    expect(requests).toEqual(["project-1", "project-2"]);
  });

  it.each([
    ["price", () => updateBid({ id: "b1", price: "300", status: "offer" } as never, 300)],
    ["status", () => updateBidStatus("b1", "sod")],
    ["contracted", () => updateBidContracted("b1", true)],
    ["insert", () => insertBids([])],
    ["delete", () => deleteBid("b1")],
  ])("invalidates the overview only after persisting a bid %s change", async (_name, persist) => {
    database(success);
    const { client } = setup();
    client.setQueryDefaults(["overviewTenantData"], { gcTime: Infinity });
    client.setQueryDefaults(["unrelated"], { gcTime: Infinity });
    const overviewKey = ["overviewTenantData", "user-1", ["project-1"]];
    client.setQueryData(overviewKey, { total: 1 });
    client.setQueryData(["unrelated"], { unchanged: true });
    let complete: ((response: { error: null }) => void) | undefined;
    mocks.writeBid.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    let pending: Promise<unknown>;
    act(() => { pending = persist(); });
    expect(client.getQueryState(overviewKey)?.isInvalidated).toBe(false);
    await act(async () => { complete?.({ error: null }); await pending; });
    expect(client.getQueryState(overviewKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(["unrelated"])?.isInvalidated).toBe(false);
    await expect(client.fetchQuery({ queryKey: overviewKey, staleTime: 120_000,
      queryFn: async () => ({ total: 2 }) })).resolves.toEqual({ total: 2 });
  });

  it("does not report a persisted bid change when the write fails", async () => {
    database(success);
    const { client } = setup();
    client.setQueryDefaults(["overviewTenantData"], { gcTime: Infinity });
    client.setQueryDefaults(["unrelated"], { gcTime: Infinity });
    const overviewKey = ["overviewTenantData", "user-1"];
    client.setQueryData(overviewKey, { total: 1 });
    mocks.writeBid.mockResolvedValue({ error: new Error("write failed") });
    await act(async () => { await updateBidStatus("b1", "sod"); });
    expect(client.getQueryState(overviewKey)?.isInvalidated).toBe(false);
  });

  it("refreshes summary data for incoming realtime bid changes", () => {
    database(success);
    const { client, wrapper } = setup();
    client.setQueryDefaults(["overviewTenantData"], { gcTime: Infinity });
    const overviewKey = ["overviewTenantData", "user-1"];
    client.setQueryData(overviewKey, { total: 1 });
    renderHook(() => useProjectBidRealtimeSync({ allProjectDetails: {}, selectedProjectId: null }), { wrapper });
    act(() => mocks.onRealtimeBid?.("c1"));
    expect(client.getQueryState(overviewKey)?.isInvalidated).toBe(true);
  });

  it("removes summary invalidation listeners when the app data hook unmounts", async () => {
    database(success);
    const { client, unmount } = setup();
    client.setQueryDefaults(["overviewTenantData"], { gcTime: Infinity });
    const overviewKey = ["overviewTenantData", "user-1"];
    client.setQueryData(overviewKey, { total: 1 });
    unmount();
    mocks.writeBid.mockResolvedValue({ error: null });
    await updateBidStatus("b1", "sod");
    expect(client.getQueryState(overviewKey)?.isInvalidated).toBe(false);
  });

  it("surfaces the selected error and retries only its request while preserving other data", async () => {
    let fail = true;
    const requests: string[] = [];
    database((table, id) => {
      if (table === "projects") requests.push(id);
      return table === "projects" && id === "project-1" && fail
        ? { data: null, error: new Error("internal database detail") } : success(table, id);
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.state.selectedProjectDetailsStatus).toBe("error"));
    expect(result.current.state.loadingError).toBeNull();
    expect(result.current.state.allProjectDetails["project-2"]).toBeUndefined();
    expect(result.current.state.canRetrySelectedProjectDetails).toBe(true);
    fail = false;
    await act(async () => { await result.current.actions.retrySelectedProjectDetails(); });
    await waitFor(() => expect(result.current.state.selectedProjectDetailsStatus).toBe("ready"));
    expect(requests).toEqual(["project-1", "project-1"]);
  });

  it("uses the selected project's state when switching away from a failed project", async () => {
    database((table, id) => table === "projects" && id === "project-1"
      ? { data: null, error: new Error("failed") } : success(table, id));
    const { result } = setup();
    await waitFor(() => expect(result.current.state.selectedProjectDetailsStatus).toBe("error"));
    act(() => result.current.actions.setSelectedProjectId("project-2"));
    await waitFor(() => expect(result.current.state.selectedProjectDetailsStatus).toBe("ready"));
  });

  it("shows a missing project as unavailable and never refetches an id outside the visible list", async () => {
    database(success);
    const { result, client } = setup();
    await waitFor(() => expect(result.current.state.selectedProjectDetailsStatus).toBe("ready"));
    client.setQueryData(["projectDetails", "hidden"], { id: "hidden", title: "private" });
    act(() => result.current.actions.setSelectedProjectId("hidden"));
    expect(result.current.state.selectedProjectDetailsStatus).toBe("unavailable");
    expect(result.current.state.canRetrySelectedProjectDetails).toBe(false);
    const calls = mocks.from.mock.calls.length;
    await act(async () => { await result.current.actions.retrySelectedProjectDetails(); });
    expect(mocks.from).toHaveBeenCalledTimes(calls);
  });

  it("keeps missing or inaccessible rows distinct from transient request errors", async () => {
    database((table, id) => table === "projects" && id === "project-1"
      ? { data: null, error: null } : success(table, id));
    const { result } = setup();
    await waitFor(() => expect(result.current.state.selectedProjectDetailsStatus).toBe("unavailable"));
    expect(result.current.state.canRetrySelectedProjectDetails).toBe(true);
  });

  it("keeps retries local and deduplicates clicks while the project request is pending", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    let attempts = 0;
    database((table, id) => {
      if (table !== "projects" || id !== "project-1") return success(table, id);
      attempts += 1;
      if (attempts === 1) return { data: null, error: new Error("failed") };
      return new Promise<Response>((resolve) => { resolveRequest = resolve; });
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.state.selectedProjectDetailsStatus).toBe("error"));
    let retry: Promise<void>;
    act(() => { retry = result.current.actions.retrySelectedProjectDetails(); });
    await waitFor(() => expect(result.current.state.isSelectedProjectDetailsFetching).toBe(true));
    expect(result.current.state.isDataLoading).toBe(false);
    await act(async () => { await result.current.actions.retrySelectedProjectDetails(); });
    expect(attempts).toBe(2);
    await act(async () => { resolveRequest?.(success("projects", "project-1")); await retry; });
    await waitFor(() => expect(result.current.state.selectedProjectDetailsStatus).toBe("ready"));
  });

  it("hides cached detail when a refresh reports that the project is no longer accessible", async () => {
    let accessible = true;
    database((table, id) => table === "projects" && id === "project-1" && !accessible
      ? { data: null, error: null } : success(table, id));
    const { result, client } = setup();
    await waitFor(() => expect(result.current.state.selectedProjectDetailsStatus).toBe("ready"));
    accessible = false;
    await act(async () => {
      await client.refetchQueries({ queryKey: ["projectDetails", "project-1"], exact: true });
    });
    await waitFor(() => expect(result.current.state.selectedProjectDetailsStatus).toBe("unavailable"));
    expect(result.current.state.allProjectDetails["project-1"]).toBeDefined();
  });

  it("keeps a repeated failure actionable and stops its pending indicator", async () => {
    database((table, id) => table === "projects" && id === "project-1"
      ? { data: null, error: new Error("failed") } : success(table, id));
    const { result } = setup();
    await waitFor(() => expect(result.current.state.selectedProjectDetailsStatus).toBe("error"));
    await act(async () => { await result.current.actions.retrySelectedProjectDetails(); });
    await waitFor(() => expect(result.current.state.isSelectedProjectDetailsFetching).toBe(false));
    expect(result.current.state.selectedProjectDetailsStatus).toBe("error");
    expect(result.current.state.canRetrySelectedProjectDetails).toBe(true);
  });

  it("keeps project loading local while other project requests are pending", async () => {
    database((table, id) => table === "projects" ? new Promise<Response>(() => {}) : success(table, id));
    const { result } = setup();
    expect(result.current.state.selectedProjectDetailsStatus).toBe("loading");
    expect(result.current.state.isDataLoading).toBe(false);
  });

  it("reports a failed project list as an actionable error and retries only that list", async () => {
    mocks.projects = [];
    mocks.projectsError = new Error("list request failed");
    database(success);
    const { result } = setup();
    expect(result.current.state.selectedProjectDetailsStatus).toBe("error");
    expect(result.current.state.canRetrySelectedProjectDetails).toBe(true);
    await act(async () => { await result.current.actions.retrySelectedProjectDetails(); });
    expect(mocks.projectsRefetch).toHaveBeenCalledWith({ cancelRefetch: false });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("waits for the visible project list before classifying an id as unavailable", () => {
    mocks.projects = [];
    mocks.projectsLoading = true;
    database(success);
    const { result } = setup();
    expect(result.current.state.selectedProjectDetailsStatus).toBe("loading");
    expect(result.current.state.isDataLoading).toBe(true);
  });
});


it("surfaces a saved category whose tender plan failed without requiring category recreation", async () => {
  database(success);
  mocks.getPlans.mockRejectedValue(new Error("offline"));
  const { result } = setup(false);
  await act(async () => { await result.current.actions.handleAddCategory("project-1", { id: "c1", title: "Okna" } as never); });
  expect(result.current.state.categoryPlanNotices).toEqual([expect.objectContaining({ status: "error", categoryTitle: "Okna" })]);
});
