import React, { useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
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
function setup(userRole = "user", directory: Subcontractor[] = [supplier], client = new QueryClient()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(({ projectId, categoryId, userId = "user-1", organizationId = "org-1" }: { projectId: string; categoryId: string; userId?: string; organizationId?: string }) => {
    const [bids, setBids] = useState<Record<string, Bid[]>>({ cat: [bid], other: [{ ...bid, id: "other-bid" }] });
    const selection = usePipelineRecipientSelection({ projectId, categoryId, userId, organizationId, bids, contacts: directory, userRole });
    return { ...selection, bids, setBids };
  }, { wrapper, initialProps: { projectId: "project", categoryId: "cat" } });
  return { ...hook, client };
}

describe("choosing an inquiry recipient independently of persistence", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.save.mockResolvedValue(patch); });
  it("uses the chosen recipient immediately while persistence is pending", async () => {
    let finish!: (value: typeof patch) => void;
    mocks.save.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const h = setup();
    let request!: Promise<void>;
    await act(async () => { request = h.result.current.selectRecipient("bid", "eva"); });
    await waitFor(() => expect(h.result.current.inquiryBids.cat[0].email).toBe(patch.email));
    expect(h.result.current.inquiryBids.other[0].email).toBe(bid.email);
    const draft = { ...h.result.current.inquiryBids.cat[0] };
    act(() => h.result.current.setBids(previous => ({ ...previous, cat: [{ ...bid, email: "edit@example.com", price: "200" }] })));
    expect(draft.email).toBe(patch.email);
    expect(h.result.current.inquiryBids.cat[0].price).toBe("200");
    await act(async () => { finish(patch); await request; });
  });
  it("preserves a failed choice and its warning across unmount and remount", async () => {
    mocks.save.mockRejectedValue(new RecipientSaveError(true));
    const h = setup();
    await act(async () => { await expect(h.result.current.selectRecipient("bid", "eva")).rejects.toThrow(); });
    h.unmount();
    const returned = setup("user", [supplier], h.client);
    expect(returned.result.current.inquiryBids.cat[0].email).toBe(patch.email);
    expect(returned.result.current.stateFor("bid")?.error).toBe(true);
    expect(selectBulkInquiryRecipients(returned.result.current.inquiryBids.cat).emails).toEqual([patch.email]);
  });
  it("keeps selections scoped to the project and rejects foreign contacts", async () => {
    const h = setup();
    await act(async () => { await h.result.current.selectRecipient("bid", "eva"); });
    h.rerender({ projectId: "another", categoryId: "cat" });
    expect(h.result.current.inquiryBids.cat[0].email).toBe(bid.email);
    await act(async () => { await expect(h.result.current.selectRecipient("bid", "foreign")).rejects.toThrow(); });
  });
  it("does not expose session choices to a different user or organization", async () => {
    const h = setup();
    await act(async () => { await h.result.current.selectRecipient("bid", "eva"); });
    h.rerender({ projectId: "project", categoryId: "cat", userId: "other-user" });
    expect(h.result.current.inquiryBids.cat[0].email).toBe(bid.email);
    h.rerender({ projectId: "project", categoryId: "cat", organizationId: "other-org" });
    expect(h.result.current.inquiryBids.cat[0].email).toBe(bid.email);
  });
  it("uses an explicit manual edit for the next draft before the form save completes", async () => {
    const h = setup();
    let finish!: () => void;
    let saving!: Promise<void>;
    await act(async () => { saving = h.result.current.saveEditedBid({ ...bid, email: "manual@example.com" }, bid,
      () => new Promise<void>(resolve => { finish = resolve; })); });
    await waitFor(() => expect(h.result.current.inquiryBids.cat[0].email).toBe("manual@example.com"));
    await act(async () => { finish(); await saving; });
  });
  it("does not pin a recipient when only price changes", async () => {
    const h = setup();
    const save = vi.fn().mockResolvedValue(undefined);
    await act(async () => { await h.result.current.saveEditedBid({ ...bid, price: "200" }, bid, save); });
    expect(save).toHaveBeenCalledWith(false);
    act(() => h.result.current.setBids({ cat: [{ ...bid, email: "other-editor@example.com" }] }));
    expect(h.result.current.inquiryBids.cat[0].email).toBe("other-editor@example.com");
    expect(h.result.current.stateFor("bid")).toBeUndefined();
  });
  it("queues remembering a choice after the old form save but generates immediately", async () => {
    const h = setup();
    let finish!: () => void;
    let saving!: Promise<void>;
    let choosing!: Promise<void>;
    await act(async () => { saving = h.result.current.saveEditedBid({ ...bid, email: "form@example.com" }, bid,
      () => new Promise<void>(resolve => { finish = resolve; })); });
    await act(async () => { choosing = h.result.current.selectRecipient("bid", "eva"); });
    await waitFor(() => expect(h.result.current.inquiryBids.cat[0].email).toBe(patch.email));
    const generate = vi.fn().mockResolvedValue(undefined);
    await act(async () => { await h.result.current.generateInquiry(h.result.current.inquiryBids.cat[0], generate); });
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ email: patch.email }));
    expect(mocks.save).not.toHaveBeenCalled();
    await act(async () => { finish(); await saving; await choosing; });
    expect(mocks.save).toHaveBeenCalledOnce();
  });
  it("prevents duplicate generation across remount without blocking other cards", async () => {
    const h = setup();
    let finish!: () => void;
    let pending!: Promise<void>;
    await act(async () => { pending = h.result.current.generateInquiry(bid, () => new Promise<void>(resolve => { finish = resolve; })); });
    h.unmount();
    const returned = setup("user", [supplier], h.client);
    expect(returned.result.current.isGenerating("bid")).toBe(true);
    const second = vi.fn().mockResolvedValue(undefined);
    await act(async () => { await returned.result.current.generateInquiry(bid, second); });
    expect(second).not.toHaveBeenCalled();
    await act(async () => { await returned.result.current.generateInquiry({ ...bid, id: "another" }, second); });
    expect(second).toHaveBeenCalledOnce();
    await act(async () => { finish(); await pending; });
    await act(async () => { await returned.result.current.generateInquiry(bid, second); });
    expect(second).toHaveBeenCalledTimes(2);
  });
});
