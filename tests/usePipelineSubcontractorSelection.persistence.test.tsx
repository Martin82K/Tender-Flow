import React, { useCallback } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bid, DemandCategory, ProjectDetails, Subcontractor } from "@/types";

const mocks = vi.hoisted(() => ({ insert: vi.fn(), saveDemoData: vi.fn(), getDemoData: vi.fn(), autoCreate: vi.fn() }));
vi.mock("@/features/projects/api", () => ({ insertBids: mocks.insert }));
vi.mock("@features/projects/api/projectDemoDataApi", () => ({ projectDemoDataApi: {
  getDemoData: mocks.getDemoData, saveDemoData: mocks.saveDemoData,
} }));
vi.mock("@infra/functions/functionsClient", () => ({ invokeAuthedFunction: mocks.autoCreate }));
vi.mock("@infra/files/fileSystemService", () => ({ ensureStructure: vi.fn() }));
vi.mock("@infra/platform/platformAdapter", () => ({ isDesktop: false }));
vi.mock("@/shared/dochub/docHub", () => ({}));
import { usePipelineSubcontractorSelection } from "@features/projects/model/usePipelineSubcontractorSelection";
import { usePipelineBidsState } from "@features/projects/model/usePipelineBidsState";

type Bids = Record<string, Bid[]>;
const category = { id: "category-1", title: "Test" } as DemandCategory;
const contact: Subcontractor = { id: "supplier-1", company: "Firma", contacts: [], specialization: [], status: "available" };
const row = { id: "saved-1", demand_category_id: category.id, subcontractor_id: contact.id, company_name: contact.company,
  contact_person: "-", email: "-", phone: "-", price: null, price_display: "?", status: "contacted", tags: [] };
const key = ["projectDetails", "project-1"];
const savedResponse = { data: [row], error: null, insertedIds: [row.id] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
function setup(userRole = "user", docHubEnabled = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(key, { id: "project-1", bids: {} });
  let serverBids: Bids = {};
  const queryFn = vi.fn(async () => ({ id: "project-1", bids: serverBids }));
  const showAlert = vi.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(({ projectId, activeCategory }) => {
    const query = useQuery({ queryKey: ["projectDetails", projectId], queryFn, staleTime: Infinity });
    const onBidsChange = useCallback((bids: Bids) => {
      client.setQueryData(["projectDetails", projectId], (old: ProjectDetails | undefined) => old ? { ...old, bids } : old);
    }, [projectId]);
    const state = usePipelineBidsState({ initialBids: query.data?.bids ?? {}, onBidsChange });
    const selection = usePipelineSubcontractorSelection({ activeCategory, bids: state.bids, updateBidsInternal: state.updateBidsInternal,
      userRole, projectDataId: projectId, isDocHubEnabled: docHubEnabled, projectDataDocHubProvider: "gdrive", docHubRoot: "", showAlert });
    return { ...selection, bids: state.bids };
  }, { wrapper, initialProps: { projectId: "project-1", activeCategory: category } });
  act(() => { hook.result.current.setIsSubcontractorModalOpen(true); hook.result.current.setSelectedSubcontractorIds(new Set([contact.id])); });
  return { ...hook, client, queryFn, showAlert, setServerBids: (bids: Bids) => { serverBids = bids; } };
}
const bid: Bid = { id: row.id, subcontractorId: contact.id, companyName: contact.company, contactPerson: "-", email: "-", phone: "-", price: "?", status: "contacted", tags: [], contracted: false };

describe("pipeline supplier persistence", () => {
  beforeEach(() => { mocks.insert.mockReset(); mocks.getDemoData.mockReset(); mocks.saveDemoData.mockReset(); mocks.autoCreate.mockReset(); });

  it("submits once and shows no unconfirmed card while the request is pending", async () => {
    const pending = deferred<typeof savedResponse>(); mocks.insert.mockReturnValue(pending.promise);
    const h = setup(); h.setServerBids({ [category.id]: [bid] });
    let first!: Promise<void>;
    act(() => { first = h.result.current.handleAddSubcontractors([contact]); void h.result.current.handleAddSubcontractors([contact]); });
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(h.result.current.bids[category.id] ?? []).toHaveLength(0);
    expect(h.result.current.isSubcontractorModalOpen).toBe(true);
    await act(async () => { pending.resolve(savedResponse); await first; });
    await waitFor(() => expect(h.result.current.bids[category.id]).toEqual([bid]));
    expect(h.result.current.isSubcontractorModalOpen).toBe(false);
  });

  it("cancels an older detail response and immediately shows the confirmed bid", async () => {
    const pending = deferred<typeof savedResponse>(); mocks.insert.mockReturnValue(pending.promise);
    const h = setup();
    const stale = deferred<{ id: string; bids: Bids }>();
    h.queryFn.mockImplementationOnce(() => stale.promise);
    act(() => { void h.client.invalidateQueries({ queryKey: key }); });
    let request!: Promise<void>;
    act(() => { request = h.result.current.handleAddSubcontractors([contact]); });
    h.setServerBids({ [category.id]: [bid] });
    await act(async () => { pending.resolve(savedResponse); await request; });
    await act(async () => { stale.resolve({ id: "project-1", bids: {} }); });
    await waitFor(() => expect(h.result.current.bids[category.id]).toEqual([bid]));
    expect(h.queryFn).toHaveBeenCalledTimes(2);
  });

  it("keeps the selection open after a rejected write and leaves no phantom bid", async () => {
    mocks.insert.mockResolvedValue({ data: null, error: { message: "denied", code: "42501" }, insertedIds: [] });
    const h = setup();
    await act(async () => { await h.result.current.handleAddSubcontractors([contact]); });
    expect(h.result.current.bids[category.id] ?? []).toHaveLength(0);
    expect(h.result.current.isSubcontractorModalOpen).toBe(true);
    expect(h.result.current.selectedSubcontractorIds).toEqual(new Set([contact.id]));
    expect(h.showAlert).toHaveBeenCalledWith(expect.objectContaining({ variant: "danger" }));
  });

  it("keeps confirmed partial results and folders while retrying only the remaining supplier", async () => {
    const nextContact = { ...contact, id: "supplier-2", company: "Druhá firma" };
    const nextRow = { ...row, id: "saved-2", subcontractor_id: nextContact.id, company_name: nextContact.company };
    const nextBid = { ...bid, id: nextRow.id, subcontractorId: nextContact.id, companyName: nextContact.company };
    mocks.insert.mockResolvedValueOnce({ ...savedResponse, error: { code: "42501" } })
      .mockResolvedValueOnce({ data: [nextRow], error: null, insertedIds: [nextRow.id] });
    mocks.autoCreate.mockResolvedValue({});
    const h = setup("user", true); h.setServerBids({ [category.id]: [bid] });
    act(() => h.result.current.setSelectedSubcontractorIds(new Set([contact.id, nextContact.id])));
    await act(async () => { await h.result.current.handleAddSubcontractors([contact, nextContact]); });
    await waitFor(() => expect(h.result.current.bids[category.id]).toEqual([bid]));
    expect(h.result.current.isSubcontractorModalOpen).toBe(true);
    expect(h.result.current.selectedSubcontractorIds).toEqual(new Set([nextContact.id]));
    expect(h.showAlert).toHaveBeenCalledWith(expect.objectContaining({ title: "Uložena část dodavatelů", variant: "info" }));
    expect(mocks.autoCreate).toHaveBeenCalledOnce();
    h.setServerBids({ [category.id]: [bid, nextBid] });
    await act(async () => { await h.result.current.handleAddSubcontractors([contact, nextContact]); });
    expect(mocks.insert.mock.calls[1][0].map((item: { subcontractor_id: string }) => item.subcontractor_id)).toEqual([nextContact.id]);
    expect(h.result.current.isSubcontractorModalOpen).toBe(false);
    await waitFor(() => expect(h.result.current.bids[category.id]).toEqual([bid, nextBid]));
  });

  it("retains a saved bid when refreshing fails and explains that the save succeeded", async () => {
    mocks.insert.mockResolvedValue(savedResponse);
    const h = setup(); h.queryFn.mockRejectedValue(new Error("offline"));
    await act(async () => { await h.result.current.handleAddSubcontractors([contact]); });
    await waitFor(() => expect(h.result.current.bids[category.id]).toEqual([bid]));
    expect(h.showAlert).toHaveBeenCalledWith(expect.objectContaining({ title: "Dodavatelé uloženi", variant: "info" }));
  });

  it("does not close a new category selector when the previous request finishes", async () => {
    const pending = deferred<typeof savedResponse>(); mocks.insert.mockReturnValue(pending.promise);
    const h = setup(); h.setServerBids({ [category.id]: [bid] });
    let request!: Promise<void>;
    act(() => { request = h.result.current.handleAddSubcontractors([contact]); });
    h.rerender({ projectId: "project-1", activeCategory: { ...category, id: "category-2" } });
    act(() => { h.result.current.setIsSubcontractorModalOpen(true); h.result.current.setSelectedSubcontractorIds(new Set(["supplier-2"])); });
    await act(async () => { pending.resolve(savedResponse); await request; });
    expect(h.result.current.isSubcontractorModalOpen).toBe(true);
    expect(h.result.current.selectedSubcontractorIds).toEqual(new Set(["supplier-2"]));
    expect((h.client.getQueryData(key) as ProjectDetails).bids[category.id]).toEqual([bid]);
  });

  it("does not recreate detail data after access was removed during the request", async () => {
    const pending = deferred<typeof savedResponse>(); mocks.insert.mockReturnValue(pending.promise);
    const h = setup();
    let request!: Promise<void>;
    act(() => { request = h.result.current.handleAddSubcontractors([contact]); });
    h.unmount();
    h.client.setQueryData(key, null);
    await act(async () => { pending.resolve(savedResponse); await request; });
    expect(h.client.getQueryData(key)).toBeNull();
    expect(h.showAlert).not.toHaveBeenCalled();
  });

  it("leaves a different project's cached bids intact when the previous write completes", async () => {
    const pending = deferred<typeof savedResponse>(); mocks.insert.mockReturnValue(pending.promise);
    const h = setup(); h.setServerBids({ [category.id]: [bid] });
    const other = { id: "project-2", bids: { untouched: [{ ...bid, id: "other" }] } };
    h.client.setQueryData(["projectDetails", "project-2"], other);
    let request!: Promise<void>;
    act(() => { request = h.result.current.handleAddSubcontractors([contact]); });
    h.rerender({ projectId: "project-2", activeCategory: { ...category, id: "category-2" } });
    await act(async () => { pending.resolve(savedResponse); await request; });
    expect(h.client.getQueryData(["projectDetails", "project-2"])).toEqual(other);
  });

  it("keeps existing demo bids and persists a new supplier once", async () => {
    const existing = { ...bid, subcontractorId: "other", id: "original", price: "900" };
    mocks.getDemoData.mockReturnValue({ projectDetails: { "project-1": { bids: { [category.id]: [existing] } } } });
    const h = setup("demo");
    await act(async () => { await h.result.current.handleAddSubcontractors([contact]); });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.saveDemoData).toHaveBeenCalledOnce();
    expect(h.result.current.bids[category.id]).toHaveLength(2);
    expect(h.result.current.bids[category.id][0]).toEqual(existing);
  });

  it.each([true, false])("only creates DocHub folders for new rows (new: %s)", async isNew => {
    mocks.insert.mockResolvedValue({ ...savedResponse, insertedIds: isNew ? [row.id] : [] });
    mocks.autoCreate.mockResolvedValue({});
    const h = setup("user", true); h.setServerBids({ [category.id]: [bid] });
    await act(async () => { await h.result.current.handleAddSubcontractors([contact]); });
    expect(mocks.autoCreate).toHaveBeenCalledTimes(isNew ? 1 : 0);
  });
});
