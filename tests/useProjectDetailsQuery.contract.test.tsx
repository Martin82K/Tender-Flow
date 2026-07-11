import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectDetails } from "@/types";

type QueryOptions = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<ProjectDetails>;
  enabled: boolean;
  staleTime: number;
};

type QueriesOptions = {
  queries: Array<{
    queryKey: readonly unknown[];
    queryFn: () => Promise<ProjectDetails>;
    staleTime: number;
  }>;
  combine: (results: Array<Record<string, unknown>>) => unknown;
};

const state = vi.hoisted(() => ({
  queryOptions: null as QueryOptions | null,
  queriesOptions: null as QueriesOptions | null,
  from: vi.fn(),
  isDemoSession: vi.fn(() => false),
  isDemoProjectId: vi.fn(() => false),
  getProjectDetails: vi.fn(),
  withRetry: vi.fn((operation: () => Promise<unknown>) => operation()),
  applyLocalBudgetAttachments: vi.fn(
    (_projectId: string, categories: unknown[]) => categories,
  ),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: QueryOptions) => {
    state.queryOptions = options;
    return { data: undefined, isLoading: true, isError: false };
  },
  useQueries: (options: QueriesOptions) => {
    state.queriesOptions = options;
    return { data: {}, isLoading: true, isError: false };
  },
}));

vi.mock("@infra/db/dbAdapter", () => ({
  dbAdapter: { from: state.from },
}));

vi.mock("@shared/async/asyncControl", () => ({
  withRetry: state.withRetry,
}));

vi.mock("@features/projects/api/projectDemoDataApi", () => ({
  projectDemoDataApi: {
    isDemoSession: state.isDemoSession,
    isDemoProjectId: state.isDemoProjectId,
    getProjectDetails: state.getProjectDetails,
  },
}));

vi.mock("@features/projects/model/budgetAttachmentLocalStore", () => ({
  applyLocalBudgetAttachments: state.applyLocalBudgetAttachments,
}));

import {
  PROJECT_DETAILS_KEYS,
  useAllProjectDetailsQuery,
  useProjectDetailsQuery,
} from "@features/projects/hooks/useProjectDetailsQuery";
import {
  PROJECT_DETAILS_KEYS as legacyProjectDetailsKeys,
  useAllProjectDetailsQuery as legacyUseAllProjectDetailsQuery,
  useProjectDetailsQuery as legacyUseProjectDetailsQuery,
} from "@/hooks/queries/useProjectDetailsQuery";

type DatabaseResponse = { data: unknown; error: Error | null };

const mockDatabaseResponses = (
  responses: Record<string, DatabaseResponse>,
): void => {
  state.from.mockImplementation((table: string) => {
    const response = Promise.resolve(
      responses[table] ?? { data: [], error: null },
    );
    const terminal = {
      single: () => response,
      maybeSingle: () => response,
      order: () => response,
      then: response.then.bind(response),
    };

    return {
      select: () => ({
        eq: () => terminal,
        in: () => response,
      }),
    };
  });
};

describe("useProjectDetailsQuery contract", () => {
  beforeEach(() => {
    state.queryOptions = null;
    state.queriesOptions = null;
    state.from.mockReset();
    state.isDemoSession.mockReset();
    state.isDemoSession.mockReturnValue(false);
    state.isDemoProjectId.mockReset();
    state.isDemoProjectId.mockReturnValue(false);
    state.getProjectDetails.mockReset();
    state.withRetry.mockClear();
    state.applyLocalBudgetAttachments.mockClear();
  });

  it("keeps legacy imports as identical compatibility exports", () => {
    expect(legacyProjectDetailsKeys).toBe(PROJECT_DETAILS_KEYS);
    expect(legacyUseProjectDetailsQuery).toBe(useProjectDetailsQuery);
    expect(legacyUseAllProjectDetailsQuery).toBe(useAllProjectDetailsQuery);
  });

  it("preserves detail query identity, enablement, and stale time", () => {
    renderHook(() => useProjectDetailsQuery("project-1", false));

    expect(state.queryOptions?.queryKey).toEqual(["projectDetails", "project-1"]);
    expect(state.queryOptions?.enabled).toBe(false);
    expect(state.queryOptions?.staleTime).toBe(5 * 60 * 1000);
  });

  it("keeps a missing project id disabled", () => {
    renderHook(() => useProjectDetailsQuery(undefined));

    expect(state.queryOptions?.queryKey).toEqual(["projectDetails", undefined]);
    expect(state.queryOptions?.enabled).toBe(false);
  });

  it("returns demo details without touching the database", async () => {
    const demoDetails = {
      id: "demo-project-1",
      title: "Demo",
      categories: [],
      bids: {},
    } as ProjectDetails;
    state.isDemoSession.mockReturnValue(true);
    state.getProjectDetails.mockReturnValue(demoDetails);

    renderHook(() => useProjectDetailsQuery("demo-project-1"));

    await expect(state.queryOptions?.queryFn()).resolves.toBe(demoDetails);
    expect(state.getProjectDetails).toHaveBeenCalledWith("demo-project-1");
    expect(state.from).not.toHaveBeenCalled();
  });

  it("starts all independent project metadata requests in parallel", async () => {
    const pendingResolvers = new Map<
      string,
      (value: { data: unknown; error: null }) => void
    >();
    const responseFor = (table: string) =>
      new Promise<{ data: unknown; error: null }>((resolve) => {
        pendingResolvers.set(table, resolve);
      });
    const tables = [
      "projects",
      "demand_categories",
      "project_contracts",
      "project_investor_financials",
      "project_amendments",
      "project_internal_amendments",
      "project_investor_invoices",
    ];

    state.from.mockImplementation((table: string) => {
      const response = responseFor(table);
      const terminal = {
        single: () => response,
        maybeSingle: () => response,
        order: () => response,
        then: response.then.bind(response),
      };
      return {
        select: () => ({
          eq: () => terminal,
        }),
      };
    });

    renderHook(() => useProjectDetailsQuery("project-1"));
    const result = state.queryOptions?.queryFn();

    expect(state.from.mock.calls.map(([table]) => table)).toEqual(tables);

    for (const table of tables) {
      pendingResolvers.get(table)?.({
        data:
          table === "projects"
            ? { id: "project-1", name: "Projekt", status: "realization" }
            : [],
        error: null,
      });
    }

    await expect(result).resolves.toEqual(
      expect.objectContaining({ id: "project-1", title: "Projekt", bids: {} }),
    );
    expect(state.from).not.toHaveBeenCalledWith("bids");
  });

  it("preserves project, category, DocHub, contract, finance, and bid mapping", async () => {
    mockDatabaseResponses({
      projects: {
        data: {
          id: "project-1",
          name: "Projekt 1",
          status: "realization",
          address: "Karlovo náměstí 1",
          latitude: 50.0755,
          longitude: 14.4378,
          geocoded_at: "2026-07-11T10:00:00Z",
          dochub_enabled: true,
          dochub_root_link: "https://example.com/root",
          dochub_provider: "gdrive",
          dochub_status: "connected",
        },
        error: null,
      },
      demand_categories: {
        data: [
          {
            id: "category-1",
            title: "Fasáda",
            budget_display: "1 000 000 Kč",
            sod_budget: 900000,
            plan_budget: 950000,
            status: "open",
          },
        ],
        error: null,
      },
      project_contracts: {
        data: {
          maturity_days: 45,
          warranty_months: 72,
          retention_terms: "5 %",
          site_facilities_percent: 2,
          insurance_percent: 1,
        },
        error: null,
      },
      project_investor_financials: {
        data: { sod_price: 1200000 },
        error: null,
      },
      project_amendments: {
        data: [{ id: "amendment-1", label: "Dodatek 1", price: 100000 }],
        error: null,
      },
      project_internal_amendments: {
        data: [{ id: "internal-1", label: "Interní 1", price: 50000 }],
        error: null,
      },
      project_investor_invoices: {
        data: [
          {
            id: "invoice-1",
            invoice_number: "2026-001",
            issue_date: "2026-07-01",
            due_date: "2026-07-31",
            amount: 250000,
            currency: "CZK",
            status: "issued",
          },
        ],
        error: null,
      },
      bids: {
        data: [
          {
            id: "bid-1",
            demand_category_id: "category-1",
            subcontractor_id: "contact-1",
            company_name: "Dodavatel s.r.o.",
            price: 880000,
            status: "offer",
            contracted: true,
          },
        ],
        error: null,
      },
    });

    renderHook(() => useProjectDetailsQuery("project-1"));
    const details = await state.queryOptions?.queryFn();

    expect(details).toEqual(
      expect.objectContaining({
        id: "project-1",
        title: "Projekt 1",
        address: "Karlovo náměstí 1",
        latitude: 50.0755,
        longitude: 14.4378,
        geocodedAt: "2026-07-11T10:00:00Z",
        docHubEnabled: true,
        docHubProvider: "gdrive",
        docHubStatus: "connected",
        internalAmendments: [
          { id: "internal-1", label: "Interní 1", price: 50000 },
        ],
        contract: {
          maturity: 45,
          warranty: 72,
          retention: "5 %",
          siteFacilities: 2,
          insurance: 1,
        },
        investorFinancials: {
          sodPrice: 1200000,
          amendments: [
            { id: "amendment-1", label: "Dodatek 1", price: 100000 },
          ],
          invoices: [
            expect.objectContaining({
              id: "invoice-1",
              invoiceNumber: "2026-001",
              amount: 250000,
            }),
          ],
        },
      }),
    );
    expect(details?.categories).toEqual([
      expect.objectContaining({
        id: "category-1",
        title: "Fasáda",
        subcontractorCount: 1,
      }),
    ]);
    expect(details?.bids).toEqual({
      "category-1": [
        expect.objectContaining({
          id: "bid-1",
          subcontractorId: "contact-1",
          price: "880000",
          contracted: true,
        }),
      ],
    });
    expect(state.applyLocalBudgetAttachments).toHaveBeenCalledOnce();
  });

  it("propagates a database response error without returning partial details", async () => {
    const projectError = new Error("project unavailable");
    mockDatabaseResponses({
      projects: { data: null, error: projectError },
    });

    renderHook(() => useProjectDetailsQuery("project-1"));

    await expect(state.queryOptions?.queryFn()).rejects.toBe(projectError);
  });

  it("preserves batch query keys, stale time, and combine output", () => {
    renderHook(() =>
      useAllProjectDetailsQuery([
        { id: "project-1" },
        { id: "project-2" },
      ] as never),
    );

    expect(state.queriesOptions?.queries).toHaveLength(2);
    expect(state.queriesOptions?.queries.map((query) => query.queryKey)).toEqual([
      ["projectDetails", "project-1"],
      ["projectDetails", "project-2"],
    ]);
    expect(
      state.queriesOptions?.queries.every(
        (query) => query.staleTime === 5 * 60 * 1000,
      ),
    ).toBe(true);

    const results = [
      {
        data: { id: "project-1", title: "Projekt 1" },
        isLoading: false,
        isError: false,
      },
      {
        data: undefined,
        isLoading: true,
        isError: true,
      },
    ];
    expect(state.queriesOptions?.combine(results)).toEqual({
      data: { "project-1": results[0].data },
      isLoading: true,
      isError: true,
      results,
    });
  });
});
