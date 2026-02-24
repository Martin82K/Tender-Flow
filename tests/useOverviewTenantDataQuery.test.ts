import { beforeEach, describe, expect, it, vi } from "vitest";
import { OVERVIEW_TENANT_DATA_KEY, useOverviewTenantDataQuery } from "../hooks/queries/useOverviewTenantDataQuery";

const mocks = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  rpcMock: vi.fn(),
  useAuthMock: vi.fn(),
  isDemoSessionMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQueryMock,
}));

vi.mock("../services/dbAdapter", () => ({
  dbAdapter: {
    rpc: mocks.rpcMock,
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: mocks.useAuthMock,
}));

vi.mock("../services/demoData", () => ({
  isDemoSession: mocks.isDemoSessionMock,
}));

const getQueryOptions = () => {
  expect(mocks.useQueryMock).toHaveBeenCalledTimes(1);
  return mocks.useQueryMock.mock.calls[0][0] as {
    queryKey: unknown[];
    enabled: boolean;
    queryFn: () => Promise<unknown>;
  };
};

describe("useOverviewTenantDataQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useQueryMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    mocks.isDemoSessionMock.mockReturnValue(false);
    mocks.useAuthMock.mockReturnValue({
      user: { id: "user-1" },
    });
    mocks.rpcMock.mockResolvedValue({
      data: { projects: [], projectDetails: {} },
      error: null,
    });
  });

  it("používá query key s user id pro izolaci cache", () => {
    useOverviewTenantDataQuery();
    const options = getQueryOptions();

    expect(options.queryKey).toEqual([...OVERVIEW_TENANT_DATA_KEY, "user-1"]);
  });

  it("query je disabled bez přihlášeného uživatele", () => {
    mocks.useAuthMock.mockReturnValue({ user: null });

    useOverviewTenantDataQuery();
    const options = getQueryOptions();

    expect(options.enabled).toBe(false);
    expect(options.queryKey).toEqual([...OVERVIEW_TENANT_DATA_KEY, null]);
  });

  it("query je disabled v demo session i s uživatelem", () => {
    mocks.isDemoSessionMock.mockReturnValue(true);

    useOverviewTenantDataQuery();
    const options = getQueryOptions();

    expect(options.enabled).toBe(false);
  });

  it("queryFn volá overview RPC a normalizuje data", async () => {
    mocks.rpcMock.mockResolvedValueOnce({
      data: { projects: [{ id: "p1" }], projectDetails: { p1: { id: "p1" } } },
      error: null,
    });

    useOverviewTenantDataQuery();
    const options = getQueryOptions();
    const result = await options.queryFn();

    expect(mocks.rpcMock).toHaveBeenCalledWith("get_overview_tenant_data");
    expect(result).toEqual({
      projects: [{ id: "p1" }],
      projectDetails: { p1: { id: "p1" } },
    });
  });
});
