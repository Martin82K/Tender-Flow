import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bid } from "@/types";
const mocks = vi.hoisted(() => ({ update: vi.fn(), read: vi.fn(), notify: vi.fn() }));
vi.mock("@/infra/projects/pipelineRepository", () => ({ pipelineRepository: { updateBidRecipient: mocks.update, fetchBidRecipient: mocks.read } }));
vi.mock("@features/projects/model/projectBidEvents", () => ({ notifyProjectBidsPersisted: mocks.notify }));
import { updateBidRecipient } from "@features/projects/api/pipelineApi";

const bid: Bid = { id: "bid", subcontractorId: "sub", companyName: "Firma", contactPerson: "Jan", status: "contacted", price: "100" };
const recipient = { contactPerson: "Eva", email: "eva@example.com", phone: "222" };
describe("recipient persistence API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.read.mockResolvedValue({ data: { id: bid.id, contact_person: "Eva", email: recipient.email, phone: "222" }, error: null });
  });
  it("sends only the recipient fields with the category and supplier scope", async () => {
    mocks.update.mockResolvedValue({ data: { id: bid.id, contact_person: "Eva", email: recipient.email, phone: "222" }, error: null });
    expect(await updateBidRecipient("cat", bid, recipient)).toEqual(recipient);
    expect(mocks.update).toHaveBeenCalledWith("cat", "bid", "sub", { contact_person: "Eva", email: recipient.email, phone: "222" });
    expect(mocks.notify).toHaveBeenCalledOnce();
  });
  it.each([
    { data: null, error: null },
    { data: null, error: { code: "42501" } },
    { data: { id: "other" }, error: null },
  ])("does not report success for inaccessible or unconfirmed rows", async response => {
    mocks.update.mockResolvedValue(response);
    await expect(updateBidRecipient("cat", bid, recipient)).rejects.toThrow();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("does not overwrite a newer editor's recipient with a delayed successful update response", async () => {
    mocks.update.mockResolvedValue({ data: { id: bid.id, contact_person: "Eva", email: recipient.email, phone: "222" }, error: null });
    mocks.read.mockResolvedValue({ data: { id: bid.id, contact_person: "Novější kontakt", email: "latest@example.com", phone: "333" }, error: null });
    await expect(updateBidRecipient("cat", bid, recipient)).rejects.toMatchObject({ recipient: { contactPerson: "Novější kontakt", email: "latest@example.com", phone: "333" } });
  });

  it("reconciles a committed update after its response is lost", async () => {
    mocks.update.mockRejectedValue(new TypeError("network failed"));
    mocks.read.mockResolvedValue({ data: { id: bid.id, contact_person: "Eva", email: recipient.email, phone: "222" }, error: null });
    expect(await updateBidRecipient("cat", bid, recipient)).toEqual(recipient);
    expect(mocks.read).toHaveBeenCalledWith("cat", bid.id, bid.subcontractorId);
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });
  it("marks a timeout with failed reconciliation as unconfirmed", async () => {
    mocks.update.mockResolvedValue({ data: null, error: { message: "timeout" }, status: 0 });
    mocks.read.mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(updateBidRecipient("cat", bid, recipient)).rejects.toMatchObject({ uncertain: true });
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("returns the authoritative contact with the error if reconciliation differs", async () => {
    mocks.update.mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    mocks.read.mockResolvedValue({ data: { id: bid.id, contact_person: "Jan", email: "jan@example.com", phone: "111" }, error: null });
    await expect(updateBidRecipient("cat", bid, recipient)).rejects.toMatchObject({ recipient: { contactPerson: "Jan", email: "jan@example.com", phone: "111" } });
  });
  it("rejects multiple recipients before a write", async () => {
    await expect(updateBidRecipient("cat", bid, { ...recipient, email: "a@example.com; b@example.com" })).rejects.toThrow();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
