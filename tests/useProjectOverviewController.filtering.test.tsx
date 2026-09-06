import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useContactsQuery: vi.fn(),
  useOverviewTenantDataQuery: vi.fn(),
  isDemoSession: vi.fn(),
  getProjectDetails: vi.fn(),
  isUserAdmin: vi.fn(),
  buildOverviewAnalytics: vi.fn(),
  buildMonthlyVolumeTrends: vi.fn(),
  filterSuppliers: vi.fn(),
  buildSupplierRows: vi.fn(),
  findExactSelectedSupplier: vi.fn(),
  sortSupplierOffersByDate: vi.fn(),
  buildSelectedSupplierSummary: vi.fn(),
  buildSelectedSupplierMonthlySeries: vi.fn(),
  buildStatusCounts: vi.fn(),
  buildAverageBudgetDeviation: vi.fn(),
}));

vi.mock("@features/contacts/hooks/useContactsQuery", () => ({
  useContactsQuery: mocks.useContactsQuery,
}));
vi.mock("@features/projects/hooks/useOverviewTenantDataQuery", () => ({
  useOverviewTenantDataQuery: mocks.useOverviewTenantDataQuery,
}));
vi.mock("@features/projects/api/projectDemoDataApi", () => ({
  projectDemoDataApi: { isDemoSession: mocks.isDemoSession, getProjectDetails: mocks.getProjectDetails },
}));
vi.mock("@/shared/auth/adminAccess", () => ({ isUserAdmin: mocks.isUserAdmin }));
vi.mock("@/shared/overview/overviewAnalytics", () => ({
  buildOverviewAnalytics: mocks.buildOverviewAnalytics,
  buildMonthlyVolumeTrends: mocks.buildMonthlyVolumeTrends,
}));
vi.mock("@/shared/overview/supplierFilters", () => ({
  filterSuppliers: mocks.filterSuppliers,
}));
vi.mock("@features/projects/model/projectOverviewModel", () => ({
  buildSupplierRows: mocks.buildSupplierRows,
  findExactSelectedSupplier: mocks.findExactSelectedSupplier,
  sortSupplierOffersByDate: mocks.sortSupplierOffersByDate,
  buildSelectedSupplierSummary: mocks.buildSelectedSupplierSummary,
  buildSelectedSupplierMonthlySeries: mocks.buildSelectedSupplierMonthlySeries,
  buildStatusCounts: mocks.buildStatusCounts,
  buildAverageBudgetDeviation: mocks.buildAverageBudgetDeviation,
}));

import { useProjectOverviewController } from "@features/projects/model/useProjectOverviewController";

const alphaSupplier = { id: "alpha", name: "Alpha", offers: [], sodCount: 2, offerCount: 3 };
const betaSupplier = { id: "beta", name: "Beta", offers: [], sodCount: 1, offerCount: 2 };

describe("useProjectOverviewController supplier filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useContactsQuery.mockReturnValue({ data: [] });
    mocks.useOverviewTenantDataQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
    mocks.isDemoSession.mockReturnValue(false);
    mocks.isUserAdmin.mockReturnValue(false);
    mocks.buildOverviewAnalytics.mockReturnValue({
      suppliers: [alphaSupplier, betaSupplier],
      categoryProfit: [],
      yearTrends: [],
      totals: {},
      totalsByStatus: {},
    });
    mocks.buildMonthlyVolumeTrends.mockReturnValue([]);
    mocks.buildSupplierRows.mockReturnValue([alphaSupplier, betaSupplier]);
    mocks.filterSuppliers.mockImplementation((suppliers, filters) => (
      filters.query === "Alpha" ? [alphaSupplier] : suppliers
    ));
    mocks.findExactSelectedSupplier.mockReturnValue(null);
    mocks.sortSupplierOffersByDate.mockReturnValue([]);
    mocks.buildSelectedSupplierSummary.mockReturnValue({});
    mocks.buildSelectedSupplierMonthlySeries.mockReturnValue({ data: [], years: [] });
    mocks.buildStatusCounts.mockReturnValue({ sod: 0, shortlist: 0, offer: 0, rejected: 0, contacted: 0, sent: 0 });
    mocks.buildAverageBudgetDeviation.mockReturnValue(null);
  });

  it("počítá stavové a cenové grafy pouze z filtrovaných dodavatelů", () => {
    const { result } = renderHook(() =>
      useProjectOverviewController({ projects: [], projectDetails: {}, user: null }),
    );

    act(() => result.current.setSupplierQuery("Alpha"));

    expect(mocks.buildStatusCounts).toHaveBeenLastCalledWith([alphaSupplier]);
    expect(mocks.buildAverageBudgetDeviation).toHaveBeenLastCalledWith([alphaSupplier]);
  });

  it("promítá stavový filtr také do měsíčních trendů", () => {
    const projects = [
      { id: "tender", name: "Soutěž", location: "Praha", status: "tender" as const },
      { id: "realization", name: "Realizace", location: "Brno", status: "realization" as const },
      { id: "archived", name: "Archiv", location: "Plzeň", status: "archived" as const },
    ];
    const projectDetails = {
      tender: { id: "tender", title: "Soutěž", categories: [], bids: {} },
      realization: { id: "realization", title: "Realizace", categories: [], bids: {} },
      archived: { id: "archived", title: "Archiv", categories: [], bids: {} },
    };
    const { result } = renderHook(() =>
      useProjectOverviewController({ projects, projectDetails, user: null }),
    );

    act(() => result.current.setStatusFilter("realization"));

    expect(mocks.buildMonthlyVolumeTrends).toHaveBeenLastCalledWith(
      [projects[1]],
      projectDetails,
    );
  });
});

it("treats a successful empty tenant summary as authoritative", () => {
  mocks.useOverviewTenantDataQuery.mockReturnValue({ data: { projects: [], projectDetails: {} }, isLoading: false, error: null });
  const { result } = renderHook(() => useProjectOverviewController({
    projects: [{ id: "stale" } as never], projectDetails: { stale: {} as never },
    user: { id: "user", email: "user@example.com", role: "user" } as never,
  }));
  expect(result.current.availableProjects).toEqual([]);
  expect(mocks.buildOverviewAnalytics).toHaveBeenLastCalledWith([], {}, "all");
});

it("does not substitute a previously opened project when the tenant summary fails", () => {
  mocks.isDemoSession.mockReturnValue(false);
  mocks.useOverviewTenantDataQuery.mockReturnValue({ data: undefined, isLoading: false, error: new Error("failed") });
  const { result } = renderHook(() => useProjectOverviewController({
    projects: [{ id: "cached" } as never], projectDetails: { cached: {} as never },
    user: { id: "user", email: "user@example.com", role: "user" } as never,
  }));
  expect(result.current.availableProjects).toEqual([]);
  expect(result.current.tenantError).toBeInstanceOf(Error);
  expect(mocks.buildOverviewAnalytics).toHaveBeenLastCalledWith([], {}, "all");
});

it("builds complete demo analytics from local data when no project was opened", () => {
  mocks.isDemoSession.mockReturnValue(true);
  mocks.useOverviewTenantDataQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
  mocks.getProjectDetails.mockImplementation(id => ({ title: id, categories: [] }));
  renderHook(() => useProjectOverviewController({
    projects: [{ id: "demo-1" }, { id: "demo-2" }] as never, projectDetails: {},
    user: { id: "demo", email: "demo@example.com", role: "demo" } as never,
  }));
  expect(mocks.buildOverviewAnalytics).toHaveBeenLastCalledWith(expect.any(Array), {
    "demo-1": { title: "demo-1", categories: [] }, "demo-2": { title: "demo-2", categories: [] },
  }, "all");
});
