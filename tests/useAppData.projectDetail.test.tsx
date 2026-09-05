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
  from: vi.fn(),
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
  useUpdateProjectDetailsMutation: () => ({}), useAddCategoryMutation: () => ({}),
  useEditCategoryMutation: () => ({}), useDeleteCategoryMutation: () => ({}),
}));
vi.mock("@/hooks/mutations/useContactMutations", () => ({
  useAddContactMutation: () => ({}), useUpdateContactMutation: () => ({}),
  useDeleteContactsMutation: () => ({}), useBulkUpdateContactsMutation: () => ({}),
  useImportContactsMutation: () => ({}),
}));
vi.mock("@/services/contactsImportService", () => ({ syncContactsFromUrl: vi.fn() }));
vi.mock("@/infra/usage/appUsageService", () => ({ recordUsageAction: vi.fn() }));
vi.mock("@/features/projects/api", () => ({}));
vi.mock("@infra/db/dbAdapter", () => ({ dbAdapter: { from: mocks.from } }));
vi.mock("@features/projects/api/projectDemoDataApi", () => ({
  projectDemoDataApi: { isDemoSession: () => false, isDemoProjectId: () => false },
}));
vi.mock("@features/projects/model/budgetAttachmentLocalStore", () => ({
  applyLocalBudgetAttachments: (_id: string, categories: unknown[]) => categories,
}));

import { useAppData } from "@/hooks/useAppData";

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
const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useAppData(vi.fn()), { wrapper });
  act(() => hook.result.current.actions.setSelectedProjectId("project-1"));
  return { ...hook, client };
};

describe("useAppData project detail recovery", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.projects = [{ id: "project-1" }, { id: "project-2" }] as Project[];
    mocks.projectsLoading = false;
    mocks.projectsError = null;
    mocks.projectsRefetch.mockReset();
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
    expect(result.current.state.allProjectDetails["project-2"]).toBeDefined();
    expect(result.current.state.canRetrySelectedProjectDetails).toBe(true);
    fail = false;
    await act(async () => { await result.current.actions.retrySelectedProjectDetails(); });
    await waitFor(() => expect(result.current.state.selectedProjectDetailsStatus).toBe("ready"));
    expect(requests).toEqual(["project-1", "project-2", "project-1"]);
  });

  it("uses the selected project's state when switching away from a failed project", async () => {
    database((table, id) => table === "projects" && id === "project-1"
      ? { data: null, error: new Error("failed") } : success(table, id));
    const { result } = setup();
    await waitFor(() => expect(result.current.state.selectedProjectDetailsStatus).toBe("error"));
    act(() => result.current.actions.setSelectedProjectId("project-2"));
    expect(result.current.state.selectedProjectDetailsStatus).toBe("ready");
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
