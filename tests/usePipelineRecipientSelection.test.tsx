import React, { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bid, Subcontractor } from "@/types";

const mocks = vi.hoisted(() => ({ save: vi.fn(), getDemoData: vi.fn(), saveDemoData: vi.fn() }));
vi.mock("@features/projects/api/pipelineApi", () => ({ updateBidRecipient: mocks.save }));
vi.mock("@features/projects/api/projectDemoDataApi", () => ({ projectDemoDataApi: mocks }));
import { usePipelineRecipientSelection } from "@features/projects/model/usePipelineRecipientSelection";
import { RecipientSaveError } from "@features/projects/model/pipelineRecipientModel";
import { selectBulkInquiryRecipients } from "@features/projects/model/pipelineEmailModel";

const bid: Bid = { id: "bid", subcontractorId: "sub", companyName: "Firma", contactPerson: "Jan", email: "jan@example.com", status: "contacted", price: "100" };
const supplier: Subcontractor = { id: "sub", company: "Firma", status: "available", specialization: [], contacts: [
  { id: "jan", name: "Jan", email: "jan@example.com", phone: "" },
  { id: "eva", name: "Eva", email: "eva@example.com", phone: "222" },
] };
const patch = { contactPerson: "Eva", email: "eva@example.com", phone: "222" };
function setup(userRole = "user", directory: Subcontractor[] = [supplier]) {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(({ projectId, categoryId }) => {
    const [bids, setBids] = useState<Record<string, Bid[]>>({ cat: [bid], other: [{ ...bid, id: "other-bid" }] });
    const selection = usePipelineRecipientSelection({ projectId, categoryId, bids, contacts: directory, userRole, updateBidsInternal: setBids });
    return { ...selection, bids, setBids };
  }, { wrapper, initialProps: { projectId: "project", categoryId: "cat" } });
  return { ...hook, client };
}

describe("choosing an inquiry recipient independently of persistence", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.save.mockResolvedValue(patch); });
  it("uses the chosen recipient immediately while persistence is still pending", async () => {
    let finish!: (value: typeof patch) => void;
    mocks.save.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const h = setup();
    let request!: Promise<void>;
    act(() => { request = h.result.current.selectRecipient("bid", "eva"); });
    expect(h.result.current.inquiryBids.cat[0].email).toBe(patch.email);
    expect(h.result.current.bids.cat[0].email).toBe(bid.email);
    expect(h.result.current.inquiryBids.other[0].email).toBe(bid.email);
    const draft = { ...h.result.current.inquiryBids.cat[0] };
    act(() => h.result.current.setBids(previous => ({ ...previous, cat: [{ ...bid, email: "edit@example.com", price: "200" }] })));
    expect(draft.email).toBe(patch.email);
    expect(h.result.current.inquiryBids.cat[0].price).toBe("200");
    await act(async () => { finish(patch); await request; });
  });
  it("keeps the explicit recipient usable when remembering it fails", async () => {
    mocks.save.mockRejectedValue(new RecipientSaveError(true));
    const h = setup();
    await act(async () => { await expect(h.result.current.selectRecipient("bid", "eva")).rejects.toThrow(); });
    expect(h.result.current.inquiryBids.cat[0].email).toBe(patch.email);
    expect(selectBulkInquiryRecipients(h.result.current.inquiryBids.cat).emails).toEqual([patch.email]);
  });
  it("keeps selections scoped to the project, category and supplier", async () => {
    const h = setup();
    await act(async () => { await h.result.current.selectRecipient("bid", "eva"); });
    h.rerender({ projectId: "another", categoryId: "cat" });
    act(() => h.result.current.setBids({ cat: [bid] }));
    expect(h.result.current.inquiryBids.cat[0].email).toBe(bid.email);
    await act(async () => { await expect(h.result.current.selectRecipient("bid", "foreign")).rejects.toThrow(); });
  });
  it("uses an explicitly edited manual contact for the next draft without waiting for the form save", async () => {
    const h = setup();
    await act(async () => { await h.result.current.selectRecipient("bid", "eva"); });
    const firstDraft = { ...h.result.current.inquiryBids.cat[0] };
    act(() => h.result.current.selectEditedRecipient({ ...bid, email: "manual@example.com" }));
    expect(h.result.current.inquiryBids.cat[0].email).toBe("manual@example.com");
    expect(firstDraft.email).toBe(patch.email);
  });
  it("does not let an older save response replace a later local choice", async () => {
    let finish!: (value: typeof patch) => void;
    mocks.save.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const h = setup();
    let first!: Promise<void>;
    act(() => { first = h.result.current.selectRecipient("bid", "eva"); });
    mocks.save.mockResolvedValueOnce({ contactPerson: bid.contactPerson, email: bid.email, phone: "" });
    await act(async () => { await h.result.current.selectRecipient("bid", "jan"); });
    await act(async () => { finish(patch); await first; });
    expect(h.result.current.inquiryBids.cat[0].email).toBe(bid.email);
    expect(h.result.current.bids.cat[0].email).toBe(bid.email);
  });
});
