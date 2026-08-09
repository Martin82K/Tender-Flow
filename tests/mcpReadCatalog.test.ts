import { describe, expect, it, vi } from "vitest";
import {
  buildSearchResults,
  getProjectSummary,
  listBids,
  listMcpTasks,
} from "../server/mcp/data.js";

type QueryResponse = { data: unknown; error: unknown };

const makeQuery = (response: QueryResponse) => {
  const query: Record<string, ReturnType<typeof vi.fn> | ((...args: unknown[]) => unknown)> = {};
  for (const method of ["select", "eq", "in", "is", "or", "order", "limit"]) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn().mockResolvedValue(response);
  query.then = (resolve: (value: QueryResponse) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(response).then(resolve, reject);
  return query;
};

describe("MCP safe read catalog", () => {
  it("staví projektové shrnutí z demand_category_id bez kontaktní PII", async () => {
    const queries = {
      projects: makeQuery({
        data: {
          id: "project-1",
          name: "Centrum",
          location: "Praha",
          status: "active",
          finish_date: "2027-01-01",
          investor: "Investor",
          organization_id: "org-1",
        },
        error: null,
      }),
      demand_categories: makeQuery({
        data: [{
          id: "tender-1",
          title: "Fasáda",
          status: "active",
          deadline: "2026-09-01",
          realization_start: null,
          realization_end: null,
          budget_display: "1 mil.",
          plan_budget: 1_000_000,
        }],
        error: null,
      }),
      tender_plans: makeQuery({ data: [], error: null }),
      contracts: makeQuery({ data: [], error: null }),
      bids: makeQuery({
        data: [{
          id: "bid-1",
          demand_category_id: "tender-1",
          price: 900_000,
          status: "submitted",
          contracted: false,
          email: "pii@example.test",
          phone: "+420111222333",
          notes: "citlivá poznámka",
          document_storage_path: "private/file.pdf",
        }],
        error: null,
      }),
    };
    const supabase = {
      from: vi.fn((table: keyof typeof queries) => queries[table]),
    };

    const summary = await getProjectSummary(supabase as never, "project-1");

    expect(summary).toMatchObject({
      project: { id: "project-1", organizationId: "org-1" },
      tenders: [{
        id: "tender-1",
        bidStats: {
          bidCount: 1,
          contractedBidCount: 0,
          pricedBidCount: 1,
          minPrice: 900_000,
          maxPrice: 900_000,
        },
      }],
    });
    expect(queries.bids.in).toHaveBeenCalledWith("demand_category_id", ["tender-1"]);
    expect(queries.bids.select).toHaveBeenCalledWith(
      "id,demand_category_id,price,status,contracted",
    );
    expect(JSON.stringify(summary)).not.toMatch(
      /pii@example|\+420111|citlivá poznámka|private\/file|subcontractor/i,
    );
  });

  it("čte vlastní tasky přes minimální select bez sync a externích metadat", async () => {
    const tasks = makeQuery({
      data: [{
        id: "task-1",
        title: "Zkontrolovat termín",
        note: "Vlastní poznámka",
        due_at: "2026-09-01T10:00:00Z",
        reminder_at: null,
        priority: 1,
        project_id: "project-1",
        related_entity_type: "category",
        related_entity_id: "tender-1",
        parent_task_id: null,
        todo_project_id: null,
        completed: false,
        completed_at: null,
        archived_at: null,
        created_at: "2026-08-09T00:00:00Z",
        updated_at: "2026-08-09T00:00:00Z",
        external_url: "https://private.example/task",
        sync_error: "secret provider payload",
      }],
      error: null,
    });
    const supabase = { from: vi.fn(() => tasks) };

    const rows = await listMcpTasks(supabase as never, { completed: false, limit: 20 });

    expect(rows).toEqual([
      expect.objectContaining({ id: "task-1", title: "Zkontrolovat termín" }),
    ]);
    expect(tasks.select).toHaveBeenCalledWith(expect.not.stringMatching(/external|sync|created_by/));
    expect(JSON.stringify(rows)).not.toMatch(/private\.example|secret provider|external|sync/i);
  });

  it("nečte subcontractors při obecném search bez contacts permission", async () => {
    const tables: string[] = [];
    const supabase = {
      from: vi.fn((table: string) => {
        tables.push(table);
        return makeQuery({ data: [], error: null });
      }),
    };

    await expect(buildSearchResults(supabase as never, "test", { includeContacts: false }))
      .resolves.toEqual([]);
    expect(tables).not.toContain("subcontractors");
  });

  it("mapuje nabídky přes produkční demand_category_id", async () => {
    const bids = makeQuery({
      data: [{
        id: "bid-1",
        demand_category_id: "tender-1",
        subcontractor_id: "supplier-1",
        price: 10,
        price_display: "10 Kč",
        notes: null,
        status: "submitted",
        contracted: false,
      }],
      error: null,
    });
    const subcontractors = makeQuery({
      data: [{
        id: "supplier-1",
        company_name: "Dodavatel s.r.o.",
        contact_person_name: "Jan Novák",
        email: "jan@example.test",
        phone: "+420123456789",
      }],
      error: null,
    });
    const supabase = {
      from: vi.fn((table: string) => (
        table === "subcontractors" ? subcontractors : bids
      )),
    };

    const rows = await listBids(supabase as never, { categoryId: "tender-1" });

    expect(bids.eq).toHaveBeenCalledWith("demand_category_id", "tender-1");
    expect(bids.select).toHaveBeenCalledWith(expect.not.stringContaining("subcontractors("));
    expect(subcontractors.in).toHaveBeenCalledWith("id", ["supplier-1"]);
    expect(rows[0]).toMatchObject({
      tenderId: "tender-1",
      companyName: "Dodavatel s.r.o.",
      contactPerson: "Jan Novák",
      email: "jan@example.test",
      phone: "+420123456789",
    });
  });
});
