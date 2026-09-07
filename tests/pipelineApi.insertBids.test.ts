import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BidInsertPayload } from "@infra/projects/pipelineRepository";

const mocks = vi.hoisted(() => ({ write: vi.fn(), read: vi.fn(), notify: vi.fn() }));
vi.mock("@/infra/projects/pipelineRepository", () => ({ pipelineRepository: {
  insertBids: mocks.write, fetchBidsForSuppliers: mocks.read,
} }));
vi.mock("@features/projects/model/projectBidEvents", () => ({ notifyProjectBidsPersisted: mocks.notify }));
import { insertBids } from "@features/projects/api/pipelineApi";

const payload: BidInsertPayload = { id: "attempt-1", demand_category_id: "category-1", subcontractor_id: "supplier-1",
  company_name: "Firma", contact_person: "Kontakt", email: null, phone: null,
  price: null, price_display: "?", notes: null, status: "contacted", tags: [] };

describe("idempotent pipeline insert", () => {
  beforeEach(() => { mocks.write.mockReset(); mocks.read.mockReset(); mocks.notify.mockReset(); });

  it("returns existing commercial data and distinguishes it from newly inserted rows", async () => {
    const existing = { ...payload, id: "original", price: 25000, status: "sod", notes: "Dohodnutá cena", price_history: { 1: "27000" } };
    const added = { ...payload, id: "new", subcontractor_id: "supplier-2" };
    mocks.write.mockResolvedValue({ data: [added], error: null });
    mocks.read.mockResolvedValue({ data: [existing, added], error: null });
    const response = await insertBids([payload, added]);
    expect(response).toEqual({ data: [existing, added], error: null, insertedIds: [added.id] });
    expect(mocks.read).toHaveBeenCalledWith("category-1", ["supplier-1", "supplier-2"]);
    expect(mocks.notify).toHaveBeenCalledOnce();
  });

  it.each(["response", "throw", "timeout"])("reconciles a committed write after a transport failure (%s) without another write", async kind => {
    if (kind === "throw") mocks.write.mockRejectedValue(new TypeError("Failed to fetch"));
    else if (kind === "timeout") mocks.write.mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    else mocks.write.mockResolvedValue({ data: null, error: { code: "", message: "Failed to fetch" }, status: 0 });
    mocks.read.mockResolvedValue({ data: [payload], error: null });
    expect(await insertBids([payload])).toEqual({ data: [payload], error: null, insertedIds: [] });
    expect(mocks.write).toHaveBeenCalledOnce();
    expect(mocks.notify).toHaveBeenCalledOnce();
  });

  it.each([408, 429, 500, 502, 503, 504])("reconciles a committed write after HTTP %s without another write", async status => {
    mocks.write.mockResolvedValue({ data: null, error: { message: "gateway failure" }, status });
    mocks.read.mockResolvedValue({ data: [payload], error: null });
    expect(await insertBids([payload])).toEqual({ data: [payload], error: null, insertedIds: [] });
    expect(mocks.write).toHaveBeenCalledOnce();
    expect(mocks.notify).toHaveBeenCalledOnce();
  });

  it("returns confirmed rows when a later batch fails and leaves the remaining selection retryable", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({ ...payload, id: `bid-${i}`, subcontractor_id: `supplier-${i}` }));
    const committed = rows.slice(0, 1000);
    const error = { code: "42501", message: "permission changed" };
    mocks.write.mockResolvedValueOnce({ data: committed, error: null })
      .mockResolvedValueOnce({ data: null, error, status: 403 });
    mocks.read.mockImplementation(async (_categoryId, ids: string[]) => ({ data: committed.filter(row => ids.includes(row.subcontractor_id)), error: null }));
    expect(await insertBids(rows)).toEqual({ data: committed, error, insertedIds: committed.map(row => row.id) });
    expect(mocks.notify).toHaveBeenCalledOnce();
  });

  it("does not disguise denied permission as a successful existing bid", async () => {
    const error = { code: "42501", message: "denied" };
    mocks.write.mockResolvedValue({ data: null, error, status: 403 });
    expect((await insertBids([payload])).error).toBe(error);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("does not confirm an incomplete or RLS-filtered result", async () => {
    mocks.write.mockResolvedValue({ data: [], error: null });
    mocks.read.mockResolvedValue({ data: [], error: null });
    expect((await insertBids([payload])).error).toBeInstanceOf(Error);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("does not resurrect a returning row that a later successful RLS read no longer exposes", async () => {
    mocks.write.mockResolvedValue({ data: [payload], error: null });
    mocks.read.mockResolvedValue({ data: [], error: null });
    const response = await insertBids([payload]);
    expect(response.data).toBeNull();
    expect(response.error).toBeInstanceOf(Error);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("retains a successful returning row when reconciliation is unavailable", async () => {
    const error = new Error("offline");
    mocks.write.mockResolvedValue({ data: [payload], error: null });
    mocks.read.mockResolvedValue({ data: null, error });
    expect(await insertBids([payload])).toEqual({ data: [payload], error: null, insertedIds: [payload.id] });
  });

  it("preserves committed earlier batches even when reconciliation also fails", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({ ...payload, id: `bid-${i}`, subcontractor_id: `supplier-${i}` }));
    const committed = rows.slice(0, 1000);
    const error = new Error("offline during reconciliation");
    mocks.write.mockResolvedValueOnce({ data: committed, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "42501" }, status: 403 });
    mocks.read.mockResolvedValue({ data: null, error });
    expect(await insertBids(rows)).toEqual({ data: committed, error, insertedIds: committed.map(row => row.id) });
    expect(mocks.notify).toHaveBeenCalledOnce();
  });

  it("deduplicates a batch by category and supplier, preserving other categories", async () => {
    const other = { ...payload, id: "other", demand_category_id: "category-2" };
    mocks.write.mockResolvedValue({ data: [payload, other], error: null });
    mocks.read.mockImplementation(async categoryId => ({ data: [categoryId === "category-1" ? payload : other], error: null }));
    expect((await insertBids([payload, payload, other])).data).toEqual([payload, other]);
    expect(mocks.write).toHaveBeenCalledWith([payload, other]);
    expect(mocks.read).toHaveBeenNthCalledWith(2, "category-2", ["supplier-1"]);
  });

  it("splits a large selection into bounded RPC batches and verifies every supplier", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({ ...payload, id: `bid-${i}`, subcontractor_id: `supplier-${i}` }));
    mocks.write.mockImplementation(async batch => ({ data: batch, error: null }));
    mocks.read.mockImplementation(async (_categoryId, ids: string[]) => ({ data: rows.filter(row => ids.includes(row.subcontractor_id)), error: null }));
    const response = await insertBids(rows);
    expect(response.error).toBeNull();
    expect(response.data).toHaveLength(1001);
    expect(mocks.write.mock.calls.map(call => call[0].length)).toEqual([1000, 1]);
    expect(response.insertedIds).toHaveLength(1001);
  });

  it("does nothing for an empty selection", async () => {
    expect(await insertBids([])).toEqual({ data: [], error: null, insertedIds: [] });
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
