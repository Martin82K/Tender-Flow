import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), calls: [] as { table: string; columns: string; ids: string[]; start: number }[], rows: {} as Record<string, Record<string, unknown>[]>, fail: "" }));
vi.mock("@infra/db/dbAdapter", () => ({ dbAdapter: { from: mocks.from } }));
import { fetchPersonalProjectOverview } from "@features/projects/api/projectOverviewSummaryApi";
beforeEach(() => {
  mocks.calls = [];
  mocks.fail = "";
  mocks.rows = {
    projects: [{ id: "p1", name: "Osobní stavba", location: "Praha", status: "tender", finish_date: "2026-09-30", organization_id: null }],
    demand_categories: [{ id: "c1", project_id: "p1", title: "Okna", sod_budget: 500, plan_budget: 400, deadline: "2026-08-30", documents: [{ id: "d1", name: "Podklad", url: "https://example.com/file" }] }],
    bids: [{ id: "b1", demand_category_id: "c1", company_name: "Dodavatel", subcontractor_id: "s1", status: "sod", price: 300 }],
    project_investor_financials: [{ project_id: "p1", sod_price: 2000 }],
    project_amendments: [{ id: "a1", project_id: "p1", label: "Dodatek", price: 100 }],
  };
  mocks.from.mockImplementation((table: string) => ({ select: (columns: string) => ({
    in: (column: string, ids: string[]) => ({ order: () => ({ range: async (start: number, end: number) => {
      mocks.calls.push({ table, columns, ids, start });
      return { data: (mocks.rows[table] ?? []).filter(row => ids.includes(String(row[column]))).slice(start, end + 1), error: mocks.fail === table ? new Error("failed page") : null };
    } }) }),
  }) }));
});
it("loads complete analytical summaries for visible personal projects without full details", async () => {
  const summary = await fetchPersonalProjectOverview(["p1", "no-access"]);
  expect(summary.projects.map(project => project.id)).toEqual(["p1"]);
  expect(summary.projectDetails.p1).toMatchObject({ title: "Osobní stavba", finishDate: "2026-09-30",
    investorFinancials: { sodPrice: 2000, amendments: [{ id: "a1", label: "Dodatek", price: 100 }] },
    categories: [{ id: "c1", title: "Okna", sodBudget: 500, subcontractorCount: 1, deadline: "2026-08-30", documents: [{ id: "d1", name: "Podklad", url: "https://example.com/file" }] }],
    bids: { c1: [{ id: "b1", price: "300", status: "sod", companyName: "Dodavatel" }] },
  });
  expect(mocks.calls).toHaveLength(5);
  expect(mocks.calls.every(call => call.columns !== "*")).toBe(true);
  expect(mocks.calls.filter(call => call.table !== "projects").every(call => !call.ids.includes("no-access"))).toBe(true);
});
it("paginates categories and bids and rejects an error instead of returning a partial summary", async () => {
  mocks.rows.demand_categories = Array.from({ length: 1201 }, (_, i) => ({ id: `c${i}`, project_id: "p1", title: `Category ${i}` }));
  const summary = await fetchPersonalProjectOverview(["p1"]);
  expect(summary.projectDetails.p1.categories).toHaveLength(1201);
  expect(mocks.calls.filter(call => call.table === "demand_categories")).toHaveLength(3);
  expect(mocks.calls.filter(call => call.table === "bids")).toHaveLength(13);
  mocks.fail = "project_amendments";
  await expect(fetchPersonalProjectOverview(["p1"])).rejects.toThrow("failed page");
});
it("does not load dependent data for denied or newly organization-owned projects", async () => {
  mocks.rows.projects[0].organization_id = "org";
  const summary = await fetchPersonalProjectOverview(["p1", "hidden"]);
  expect(summary).toEqual({ projects: [], projectDetails: {} });
  expect(mocks.calls).toHaveLength(1);
});
