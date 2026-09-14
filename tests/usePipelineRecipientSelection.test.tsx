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
    await act(async () => { request = h.result.current.selectRecipient("bid", "eva"); });
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
    await act(async () => { request = h.result.current.selectRecipient("bid", "eva"); });
    h.rerender({ projectId: "other-project", categoryId: "cat" });
    await act(async () => { finish(patch); await request; });
    expect(h.result.current.bids.cat[0]).toEqual(bid);
  });
  it("keeps the original scope locked after navigating away and back", async () => {
    let finish!: (value: typeof patch) => void;
    mocks.save.mockReturnValue(new Promise<typeof patch>(resolve => { finish = resolve; }));
    const h = setup();
    let request!: Promise<void>;
    await act(async () => { request = h.result.current.selectRecipient("bid", "eva"); });
    h.rerender({ projectId: "other-project", categoryId: "other" });
    h.rerender({ projectId: "project", categoryId: "cat" });
    expect(h.result.current.saving).toBe(true);
    await act(async () => { await expect(h.result.current.selectRecipient("bid", "eva")).rejects.toThrow(); });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    await act(async () => { finish(patch); await request; });
    expect(h.result.current.bids.cat[0].email).toBe(patch.email);
  });

  it("locks contact changes until a slow inquiry finishes, even across navigation", async () => {
    let finish!: () => void;
    const h = setup();
    let generation!: Promise<void>;
    act(() => { generation = h.result.current.generateWithRecipientLock(() => new Promise<void>(resolve => { finish = resolve; })); });
    h.rerender({ projectId: "other-project", categoryId: "other" });
    h.rerender({ projectId: "project", categoryId: "cat" });
    expect(h.result.current.generating).toBe(true);
    await act(async () => { await expect(h.result.current.selectRecipient("bid", "eva")).rejects.toThrow(); });
    expect(mocks.save).not.toHaveBeenCalled();
    await act(async () => { finish(); await generation; });
    expect(h.result.current.generating).toBe(false);
  });

  it("keeps generation blocked for an unconfirmed card until that card is saved again", async () => {
    const h = setup();
    mocks.save.mockRejectedValueOnce(new RecipientSaveError(true));
    await act(async () => { await expect(h.result.current.selectRecipient("bid", "eva")).rejects.toThrow(); });
    expect(h.result.current.unconfirmed).toBe(true);
    const generate = vi.fn();
    await act(async () => { await h.result.current.generateWithRecipientLock(generate); });
    expect(generate).not.toHaveBeenCalled();
    act(() => h.result.current.setBids(prev => ({ ...prev, cat: [...prev.cat, { ...bid, id: "another" }] })));
    await act(async () => { await h.result.current.selectRecipient("another", "eva"); });
    expect(h.result.current.unconfirmed).toBe(true);
    await act(async () => { await h.result.current.selectRecipient("bid", "eva"); });
    expect(h.result.current.unconfirmed).toBe(false);
  });

  it("keeps a pending write locked when the view is unmounted and remounted", async () => {
    let finish!: (value: typeof patch) => void;
    mocks.save.mockReturnValue(new Promise<typeof patch>(resolve => { finish = resolve; }));
    const first = setup();
    let request!: Promise<void>;
    await act(async () => { request = first.result.current.selectRecipient("bid", "eva"); });
    first.unmount();
    const next = setup();
    expect(next.result.current.saving).toBe(true);
    await act(async () => { await expect(next.result.current.selectRecipient("bid", "eva")).rejects.toThrow(); });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    await act(async () => { finish(patch); await request; });
    expect(next.result.current.saving).toBe(false);
  });

  it("does not block remaining cards after an unconfirmed card is removed", async () => {
    const h = setup();
    mocks.save.mockRejectedValueOnce(new RecipientSaveError(true));
    await act(async () => { await expect(h.result.current.selectRecipient("bid", "eva")).rejects.toThrow(); });
    act(() => h.result.current.setBids(prev => ({ ...prev, cat: [] })));
    expect(h.result.current.unconfirmed).toBe(false);
    // Restore and confirm the card to leave the shared operation store clean.
    act(() => h.result.current.setBids(prev => ({ ...prev, cat: [bid] })));
    await act(async () => { await h.result.current.selectRecipient("bid", "eva"); });
  });

  it("reconfirms a stored manual recipient after an uncertain write with an empty directory", async () => {
    const h = setup("user", []);
    mocks.save.mockRejectedValueOnce(new RecipientSaveError(true));
    await act(async () => { await expect(h.result.current.selectRecipient("bid", "saved-recipient")).rejects.toThrow(); });
    expect(h.result.current.unconfirmed).toBe(true);
    const stored = { contactPerson: bid.contactPerson, email: bid.email, phone: "" };
    mocks.save.mockResolvedValue(stored);
    await act(async () => { await h.result.current.selectRecipient("bid", "saved-recipient"); });
    expect(mocks.save).toHaveBeenLastCalledWith("cat", bid, stored);
    expect(h.result.current.unconfirmed).toBe(false);
    expect(h.result.current.bids.cat[0].email).toBe(bid.email);
  });

  it("persists demo selection for reload without calling the server", async () => {
    mocks.getDemoData.mockReturnValue({ projectDetails: { project: { bids: { cat: [bid] } } } });
    const h = setup("demo");
    await act(async () => { await h.result.current.selectRecipient("bid", "eva"); });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.saveDemoData.mock.calls[0][0].projectDetails.project.bids.cat[0]).toEqual({ ...bid, ...patch });
  });
});
