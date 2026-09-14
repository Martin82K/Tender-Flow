import React, { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bid, Subcontractor } from "@/types";

const mocks = vi.hoisted(() => ({ save: vi.fn(), getDemoData: vi.fn(), saveDemoData: vi.fn() }));
vi.mock("@features/projects/api/pipelineApi", () => ({ updateBidRecipient: mocks.save }));
vi.mock("@features/projects/api/projectDemoDataApi", () => ({ projectDemoDataApi: mocks }));
import { usePipelineRecipientSelection } from "@features/projects/model/usePipelineRecipientSelection";
import { selectBulkInquiryRecipients } from "@features/projects/model/pipelineEmailModel";

const bid: Bid = { id: "bid", subcontractorId: "sub", companyName: "Firma", contactPerson: "Jan", email: "jan@example.com", status: "contacted", price: "100" };
const supplier: Subcontractor = { id: "sub", company: "Firma", status: "available", specialization: [], contacts: [
  { id: "eva", name: "Eva", email: "eva@example.com", phone: "222" },
] };
const patch = { contactPerson: "Eva", email: "eva@example.com", phone: "222" };
function setup(userRole = "user") {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(({ projectId, categoryId }) => {
    const [bids, setBids] = useState<Record<string, Bid[]>>({ cat: [bid], other: [{ ...bid, id: "other-bid" }] });
    const selection = usePipelineRecipientSelection({ projectId, categoryId, bids, contacts: [supplier], userRole, updateBidsInternal: setBids });
    return { ...selection, bids, setBids };
  }, { wrapper, initialProps: { projectId: "project", categoryId: "cat" } });
  return { ...hook, client };
}

describe("saving a bid recipient", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.save.mockResolvedValue(patch); });
  it("persists only the recipient and uses it in the bulk selection without changing other cards", async () => {
    const h = setup();
    await act(async () => { await h.result.current.selectRecipient("bid", "eva"); });
    expect(mocks.save).toHaveBeenCalledWith("cat", bid, patch);
    expect(h.result.current.bids.cat[0]).toEqual({ ...bid, ...patch });
    expect(h.result.current.bids.other[0].email).toBe("jan@example.com");
    expect(selectBulkInquiryRecipients(h.result.current.bids.cat).emails).toEqual(["eva@example.com"]);
    expect(supplier.contacts[0]).toEqual({ id: "eva", name: "Eva", email: "eva@example.com", phone: "222" });
  });
  it("keeps the saved contact on a rejected write", async () => {
    mocks.save.mockRejectedValue(new Error("denied"));
    const h = setup();
    await act(async () => { await expect(h.result.current.selectRecipient("bid", "eva")).rejects.toThrow(); });
    expect(h.result.current.bids.cat[0]).toEqual(bid);
    expect(h.result.current.saving).toBe(false);
  });
  it("rejects a contact from outside the card's supplier and a bid outside the category", async () => {
    const h = setup();
    await act(async () => {
      await expect(h.result.current.selectRecipient("bid", "foreign")).rejects.toThrow();
      await expect(h.result.current.selectRecipient("other-bid", "eva")).rejects.toThrow();
    });
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("blocks a second save and preserves concurrent price changes", async () => {
    let finish!: (value: typeof patch) => void;
    mocks.save.mockReturnValue(new Promise<typeof patch>(resolve => { finish = resolve; }));
    const h = setup();
    let request!: Promise<void>;
    act(() => { request = h.result.current.selectRecipient("bid", "eva"); });
    expect(h.result.current.saving).toBe(true);
    expect(h.result.current.bids.cat[0].email).toBe(bid.email);
    await act(async () => { await expect(h.result.current.selectRecipient("bid", "eva")).rejects.toThrow(); });
    act(() => h.result.current.setBids(prev => ({ ...prev, cat: [{ ...bid, price: "200", status: "offer" }] })));
    await act(async () => { finish(patch); await request; });
    expect(h.result.current.bids.cat[0]).toEqual({ ...bid, ...patch, price: "200", status: "offer" });
  });
  it("does not update a new project's state when a previous save finishes", async () => {
    let finish!: (value: typeof patch) => void;
    mocks.save.mockReturnValue(new Promise<typeof patch>(resolve => { finish = resolve; }));
    const h = setup();
    let request!: Promise<void>;
    act(() => { request = h.result.current.selectRecipient("bid", "eva"); });
    h.rerender({ projectId: "other-project", categoryId: "cat" });
    await act(async () => { finish(patch); await request; });
    expect(h.result.current.bids.cat[0]).toEqual(bid);
  });
  it("persists demo selection for reload without calling the server", async () => {
    mocks.getDemoData.mockReturnValue({ projectDetails: { project: { bids: { cat: [bid] } } } });
    const h = setup("demo");
    await act(async () => { await h.result.current.selectRecipient("bid", "eva"); });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.saveDemoData.mock.calls[0][0].projectDetails.project.bids.cat[0]).toEqual({ ...bid, ...patch });
  });
});
