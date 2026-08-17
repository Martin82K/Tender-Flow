import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useContactsQuery: vi.fn(),
  useOverviewTenantDataQuery: vi.fn(),
  isDemoSession: vi.fn(),
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
  projectDemoDataApi: { isDemoSession: mocks.isDemoSession },
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
});
