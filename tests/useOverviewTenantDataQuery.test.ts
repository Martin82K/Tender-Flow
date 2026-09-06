import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryOptions = {
  queryKey: readonly unknown[];
  enabled: boolean;
  queryFn: () => Promise<unknown>;
  staleTime: number;
};

const mocks = vi.hoisted(() => ({
  queryOptions: null as QueryOptions | null,
  rpc: vi.fn(),
  personal: vi.fn(),
  useAuth: vi.fn(),
  isDemoSession: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: QueryOptions) => {
    mocks.queryOptions = options;
    return { data: undefined, isLoading: false, error: null };
  },
}));

vi.mock("@features/projects/api/projectOverviewSummaryApi", () => ({
  fetchPersonalProjectOverview: mocks.personal,
}));

vi.mock("@infra/db/dbAdapter", () => ({
  dbAdapter: { rpc: mocks.rpc },
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("@/services/demoData", () => ({
  isDemoSession: mocks.isDemoSession,
}));

import {
  OVERVIEW_TENANT_DATA_KEY,
  useOverviewTenantDataQuery,
} from "@features/projects/hooks/useOverviewTenantDataQuery";
import { normalizeOverviewTenantData } from "@features/projects/model/overviewTenantData";
import {
  OVERVIEW_TENANT_DATA_KEY as legacyOverviewTenantDataKey,
  useOverviewTenantDataQuery as legacyUseOverviewTenantDataQuery,
} from "@/hooks/queries/useOverviewTenantDataQuery";

describe("useOverviewTenantDataQuery contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryOptions = null;
    mocks.personal.mockResolvedValue({ projects: [], projectDetails: {} });
    mocks.isDemoSession.mockReturnValue(false);
    mocks.useAuth.mockReturnValue({ user: { id: "user-1" } });
    mocks.rpc.mockResolvedValue({
      data: { projects: [], projectDetails: {} },
      error: null,
    });
  });

  it("preserves query key, enablement, and two-minute stale time", () => {
    useOverviewTenantDataQuery({ userId: "user-1", isDemoSession: false });

    expect(mocks.queryOptions?.queryKey).toEqual([
      ...OVERVIEW_TENANT_DATA_KEY,
      "user-1",
    ]);
    expect(mocks.queryOptions?.enabled).toBe(true);
    expect(mocks.queryOptions?.staleTime).toBe(2 * 60 * 1000);
  });

  it("stays disabled without a user and during demo sessions", () => {
    useOverviewTenantDataQuery({ userId: undefined, isDemoSession: false });
    expect(mocks.queryOptions?.queryKey).toEqual([
      ...OVERVIEW_TENANT_DATA_KEY,
      null,
    ]);
    expect(mocks.queryOptions?.enabled).toBe(false);

    useOverviewTenantDataQuery({ userId: "user-1", isDemoSession: true });
    expect(mocks.queryOptions?.enabled).toBe(false);
  });

  it("keeps the legacy no-argument adapter behavior", () => {
    legacyUseOverviewTenantDataQuery();

    expect(legacyOverviewTenantDataKey).toBe(OVERVIEW_TENANT_DATA_KEY);
    expect(mocks.queryOptions?.queryKey).toEqual([
      ...OVERVIEW_TENANT_DATA_KEY,
      "user-1",
    ]);
    expect(mocks.queryOptions?.enabled).toBe(true);

    mocks.isDemoSession.mockReturnValue(true);
    legacyUseOverviewTenantDataQuery();
    expect(mocks.queryOptions?.enabled).toBe(false);
  });

  it("calls the overview RPC and normalizes valid data", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        projects: [{ id: "p1", name: "Projekt", location: "", status: "realization" }],
        projectDetails: {
          p1: {
            id: "p1",
            title: "Projekt",
            location: "",
            finishDate: "",
            siteManager: "",
            categories: [],
          },
        },
      },
      error: null,
    });

    useOverviewTenantDataQuery({ userId: "user-1", isDemoSession: false });
    await expect(mocks.queryOptions?.queryFn()).resolves.toEqual({
      projects: [
        { id: "p1", name: "Projekt", location: "", status: "realization" },
      ],
      projectDetails: {
        p1: {
          id: "p1",
          title: "Projekt",
          location: "",
          finishDate: "",
          siteManager: "",
          categories: [],
        },
      },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_overview_tenant_data");
  });

  it("combines personal projects outside the tenant RPC and scopes their cache by visible IDs", async () => {
    const personal = { projects: [{ id: "personal", name: "Osobní stavba" }], projectDetails: { personal: { title: "Osobní stavba", categories: [] } } };
    mocks.personal.mockResolvedValue(personal);
    useOverviewTenantDataQuery({ userId: "user-1", isDemoSession: false, personalProjectIds: ["personal"] });
    expect(mocks.queryOptions?.queryKey).toEqual([...OVERVIEW_TENANT_DATA_KEY, "user-1", ["personal"]]);
    await expect(mocks.queryOptions?.queryFn()).resolves.toEqual(personal);
    expect(mocks.personal).toHaveBeenCalledWith(["personal"]);
    mocks.personal.mockRejectedValue(new Error("personal failed"));
    await expect(mocks.queryOptions?.queryFn()).rejects.toThrow("personal failed");
  });

  it("propagates the RPC error without returning partial data", async () => {
    const rpcError = new Error("overview unavailable");
    mocks.rpc.mockResolvedValueOnce({ data: null, error: rpcError });

    useOverviewTenantDataQuery({ userId: "user-1", isDemoSession: false });

    await expect(mocks.queryOptions?.queryFn()).rejects.toBe(rpcError);
  });
});

describe("normalizeOverviewTenantData", () => {
  it("fails closed for malformed top-level collections", () => {
    const firstEmptyResult = normalizeOverviewTenantData(null);
    const secondEmptyResult = normalizeOverviewTenantData(null);

    expect(firstEmptyResult).toEqual({
      projects: [],
      projectDetails: {},
    });
    expect(firstEmptyResult.projects).not.toBe(secondEmptyResult.projects);
    expect(firstEmptyResult.projectDetails).not.toBe(
      secondEmptyResult.projectDetails,
    );
    expect(
      normalizeOverviewTenantData({
        projects: "not-an-array",
        projectDetails: [],
      }),
    ).toEqual({ projects: [], projectDetails: {} });
  });

  it("drops malformed collection entries without mutating valid entries", () => {
    const project = { id: "p1", name: "Projekt" };
    const details = { id: "p1", title: "Projekt", categories: [] };

    expect(
      normalizeOverviewTenantData({
        projects: [project, null, "bad"],
        projectDetails: { p1: details, invalid: null },
      }),
    ).toEqual({ projects: [project], projectDetails: { p1: details } });
  });
});
