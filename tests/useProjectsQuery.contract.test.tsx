import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT_KEYS } from "@/shared/queryKeys/projectKeys";
import type { AuthIdentity } from "@shared/auth/AuthIdentityContext";

type QueryOptions = {
  queryKey: readonly unknown[];
  enabled: boolean;
  queryFn: () => Promise<unknown>;
  staleTime: number;
};

type RetryOptions = {
  retries?: number;
  baseDelayMs?: number;
};

const state = vi.hoisted(() => ({
  user: {
    id: "user-1",
    email: "user@example.com",
    role: "user",
  } as AuthIdentity | null,
  options: null as QueryOptions | null,
  from: vi.fn(),
  rpc: vi.fn(),
  getDemoProjects: vi.fn(),
  legacyUseAuth: vi.fn(),
  withRetry: vi.fn(
    (operation: () => Promise<unknown>, _options?: RetryOptions) => operation(),
  ),
  withTimeout: vi.fn(
    (operation: Promise<unknown>, _ms: number, _message?: string) => operation,
  ),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: QueryOptions) => {
    state.options = options;
    return { data: undefined, isLoading: true, isError: false };
  },
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: state.legacyUseAuth,
}));

vi.mock("@infra/db/dbAdapter", () => ({
  dbAdapter: {
    from: state.from,
    rpc: state.rpc,
  },
}));

vi.mock("@shared/async/asyncControl", () => ({
  withRetry: state.withRetry,
  withTimeout: state.withTimeout,
}));

vi.mock("@features/projects/api/projectDemoDataApi", () => ({
  projectDemoDataApi: {
    getProjects: state.getDemoProjects,
  },
}));

import { useProjectsQuery } from "@features/projects/hooks/useProjectsQuery";
import { useProjectsQuery as legacyUseProjectsQuery } from "@/hooks/queries/useProjectsQuery";

describe("useProjectsQuery contract", () => {
  beforeEach(() => {
    state.options = null;
    state.user = {
      id: "user-1",
      email: "user@example.com",
      role: "user",
    };
    state.from.mockReset();
    state.rpc.mockReset();
    state.getDemoProjects.mockReset();
    state.legacyUseAuth.mockReset();
    state.legacyUseAuth.mockImplementation(() => ({ user: state.user }));
    state.withRetry.mockClear();
    state.withTimeout.mockClear();
  });

  it("keeps the legacy no-argument adapter", () => {
    renderHook(() => legacyUseProjectsQuery());

    expect(state.options?.queryKey).toEqual([...PROJECT_KEYS.list(), "user-1"]);
    expect(state.legacyUseAuth).toHaveBeenCalledOnce();
  });

  it("uses the explicitly supplied identity instead of the legacy context", () => {
    renderHook(() =>
      useProjectsQuery({
        user: {
          id: "explicit-user",
          email: "explicit@example.com",
          role: "admin",
        },
      }),
    );

    expect(state.options?.queryKey).toEqual([
      ...PROJECT_KEYS.list(),
      "explicit-user",
    ]);
    expect(state.legacyUseAuth).not.toHaveBeenCalled();
  });

  it("keeps query identity, enablement, stale time, and mapped data contract", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: "project-1",
          name: "Projekt 1",
          location: "Praha",
          status: "tender",
          archived_original_status: null,
          is_demo: false,
          owner_id: "user-1",
        },
      ],
      error: null,
    });
    const select = vi.fn(() => ({ order }));
    state.from.mockReturnValue({ select });
    state.rpc.mockResolvedValue({
      data: [
        {
          project_id: "project-1",
          owner_email: "owner@example.com",
          shared_with_emails: [],
        },
      ],
      error: null,
    });

    renderHook(() => useProjectsQuery({ user: state.user }));
    const options = state.options;
    expect(options).not.toBeNull();
    expect(options?.queryKey).toEqual([...PROJECT_KEYS.list(), "user-1"]);
    expect(options?.enabled).toBe(true);
    expect(options?.staleTime).toBe(5 * 60 * 1000);
    await expect(options?.queryFn()).resolves.toEqual([
      {
        id: "project-1",
        name: "Projekt 1",
        location: "Praha",
        status: "tender",
        archivedOriginalStatus: null,
        isDemo: false,
        ownerId: "user-1",
        ownerEmail: "owner@example.com",
        sharedWith: [],
      },
    ]);
    expect(state.from).toHaveBeenCalledWith("projects");
    expect(select).toHaveBeenCalledWith("*");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(state.rpc).toHaveBeenCalledWith("get_projects_metadata");
    expect(state.withRetry).toHaveBeenCalledTimes(2);
    expect(state.withRetry.mock.calls.map((call) => call[1])).toEqual([
      { retries: 1 },
      { retries: 1 },
    ]);
    expect(state.withTimeout.mock.calls.map((call) => call.slice(1))).toEqual([
      [12000, "Načtení projektů vypršelo"],
      [12000, "Načtení oprávnění vypršelo"],
    ]);
  });

  it("keeps the query disabled and fails closed when auth is missing", async () => {
    state.user = null;

    renderHook(() => useProjectsQuery({ user: state.user }));

    expect(state.options?.queryKey).toEqual([...PROJECT_KEYS.list(), undefined]);
    expect(state.options?.enabled).toBe(false);
    await expect(state.options?.queryFn()).resolves.toEqual([]);
    expect(state.from).not.toHaveBeenCalled();
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("propagates the projects query error", async () => {
    const projectsError = new Error("projects unavailable");
    const order = vi.fn().mockResolvedValue({ data: null, error: projectsError });
    state.from.mockReturnValue({ select: vi.fn(() => ({ order })) });
    state.rpc.mockResolvedValue({ data: [], error: null });

    renderHook(() => useProjectsQuery({ user: state.user }));

    await expect(state.options?.queryFn()).rejects.toBe(projectsError);
  });

  it("starts projects and metadata requests before either request settles", async () => {
    let resolveProjects: (
      value: { data: unknown[]; error: null },
    ) => void = () => undefined;
    let resolveMetadata: (
      value: { data: unknown[]; error: null },
    ) => void = () => undefined;
    const projectsPromise = new Promise<{ data: unknown[]; error: null }>(
      (resolve) => {
        resolveProjects = resolve;
      },
    );
    const metadataPromise = new Promise<{ data: unknown[]; error: null }>(
      (resolve) => {
        resolveMetadata = resolve;
      },
    );
    const order = vi.fn().mockReturnValue(projectsPromise);
    state.from.mockReturnValue({ select: vi.fn(() => ({ order })) });
    state.rpc.mockReturnValue(metadataPromise);

    renderHook(() => useProjectsQuery({ user: state.user }));
    const result = state.options?.queryFn();

    expect(order).toHaveBeenCalledOnce();
    expect(state.rpc).toHaveBeenCalledOnce();

    resolveProjects({ data: [], error: null });
    resolveMetadata({ data: [], error: null });
    await expect(result).resolves.toEqual([]);
  });

  it("fails closed for shared projects when metadata fails", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: "owned-project",
          name: "Vlastní projekt",
          location: "Praha",
          status: "tender",
          archived_original_status: null,
          is_demo: false,
          owner_id: "user-1",
        },
        {
          id: "possibly-shared-project",
          name: "Neověřené sdílení",
          location: "Brno",
          status: "realization",
          archived_original_status: null,
          is_demo: false,
          owner_id: "user-2",
        },
      ],
      error: null,
    });
    state.from.mockReturnValue({ select: vi.fn(() => ({ order })) });
    state.rpc.mockResolvedValue({
      data: null,
      error: new Error("metadata unavailable"),
    });

    renderHook(() => useProjectsQuery({ user: state.user }));

    await expect(state.options?.queryFn()).resolves.toEqual([
      expect.objectContaining({ id: "owned-project" }),
    ]);
  });

  it("propagates a rejected metadata operation after the retry policy", async () => {
    const metadataError = new Error("metadata transport unavailable");
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    state.from.mockReturnValue({ select: vi.fn(() => ({ order })) });
    state.rpc.mockRejectedValue(metadataError);

    renderHook(() => useProjectsQuery({ user: state.user }));

    await expect(state.options?.queryFn()).rejects.toBe(metadataError);
  });

  it("keeps the demo branch isolated from database calls", async () => {
    state.user = {
      id: "demo-user",
      email: "demo@example.com",
      role: "demo",
    };
    const demoProjects = [
      { id: "demo-1", name: "Demo", location: "", status: "tender" },
    ];
    state.getDemoProjects.mockReturnValue(demoProjects);

    renderHook(() => useProjectsQuery({ user: state.user }));
    await expect(state.options?.queryFn()).resolves.toBe(demoProjects);
    expect(state.from).not.toHaveBeenCalled();
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
