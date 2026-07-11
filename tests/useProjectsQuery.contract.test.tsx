import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT_KEYS } from "@/shared/queryKeys/projectKeys";

type QueryOptions = {
  queryKey: readonly unknown[];
  enabled: boolean;
  queryFn: () => Promise<unknown>;
  staleTime: number;
};

const state = vi.hoisted(() => ({
  user: {
    id: "user-1",
    email: "user@example.com",
    role: "user",
  } as { id: string; email: string; role: string } | null,
  options: null as QueryOptions | null,
  from: vi.fn(),
  rpc: vi.fn(),
  getDemoData: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: QueryOptions) => {
    state.options = options;
    return { data: undefined, isLoading: true, isError: false };
  },
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: state.user }),
}));

vi.mock("@/services/dbAdapter", () => ({
  dbAdapter: {
    from: state.from,
    rpc: state.rpc,
  },
}));

vi.mock("@/utils/helpers", () => ({
  withRetry: (operation: () => unknown) => operation(),
  withTimeout: (operation: Promise<unknown>) => operation,
}));

vi.mock("@/services/demoData", () => ({
  DEMO_PROJECT: {
    id: "demo-fallback",
    name: "Demo fallback",
    location: "",
    status: "tender",
  },
  getDemoData: state.getDemoData,
}));

import { useProjectsQuery } from "@/hooks/queries/useProjectsQuery";

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
    state.getDemoData.mockReset();
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

    renderHook(() => useProjectsQuery());
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
    state.getDemoData.mockReturnValue({ projects: demoProjects });

    renderHook(() => useProjectsQuery());
    await expect(state.options?.queryFn()).resolves.toBe(demoProjects);
    expect(state.from).not.toHaveBeenCalled();
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
