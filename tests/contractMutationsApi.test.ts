import { beforeEach, describe, expect, it, vi } from "vitest";

const contractServiceMock = vi.hoisted(() => ({
  createAmendment: vi.fn(),
  updateAmendment: vi.fn(),
  createContract: vi.fn(),
  updateContract: vi.fn(),
  createInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  createMarkdownVersion: vi.fn(),
  deleteAmendment: vi.fn(),
  deleteInvoice: vi.fn(),
  markInvoicePaid: vi.fn(),
  releaseRetention: vi.fn(),
}));

vi.mock("@/services/contractService", () => ({
  contractService: contractServiceMock,
}));

import { contractMutationsApi } from "../features/projects/contracts/api";

describe("contractMutationsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deleguje contract form mutace do legacy service", async () => {
    contractServiceMock.createAmendment.mockResolvedValue({ id: "amendment-1" });
    contractServiceMock.updateAmendment.mockResolvedValue({ id: "amendment-1" });
    contractServiceMock.createContract.mockResolvedValue({ id: "contract-1" });
    contractServiceMock.updateContract.mockResolvedValue({ id: "contract-1" });
    contractServiceMock.createInvoice.mockResolvedValue({ id: "invoice-1" });
    contractServiceMock.updateInvoice.mockResolvedValue({ id: "invoice-1" });
    contractServiceMock.createMarkdownVersion.mockResolvedValue({ id: "markdown-1" });
    contractServiceMock.deleteAmendment.mockResolvedValue(undefined);
    contractServiceMock.deleteInvoice.mockResolvedValue(undefined);
    contractServiceMock.markInvoicePaid.mockResolvedValue(undefined);
    contractServiceMock.releaseRetention.mockResolvedValue(undefined);

    await contractMutationsApi.createAmendment({ contractId: "contract-1" });
    await contractMutationsApi.updateAmendment("amendment-1", { reason: "Změna" });
    await contractMutationsApi.createContract({ projectId: "project-1", vendorName: "Firma", title: "SOD" });
    await contractMutationsApi.updateContract("contract-1", { title: "SOD 2" });
    await contractMutationsApi.createInvoice({ contractId: "contract-1", invoiceNumber: "FV-1", amount: 100 });
    await contractMutationsApi.updateInvoice("invoice-1", { amount: 200 });
    await contractMutationsApi.createMarkdownVersion({
      entityType: "contract",
      contractId: "contract-1",
      sourceKind: "ocr",
      contentMd: "# SOD",
    });
    await contractMutationsApi.deleteAmendment("amendment-1");
    await contractMutationsApi.markInvoicePaid("invoice-1", "2026-05-06");
    await contractMutationsApi.deleteInvoice("invoice-1");
    await contractMutationsApi.releaseRetention("contract-1", "short");

    expect(contractServiceMock.createAmendment).toHaveBeenCalledWith({ contractId: "contract-1" });
    expect(contractServiceMock.updateAmendment).toHaveBeenCalledWith("amendment-1", { reason: "Změna" });
    expect(contractServiceMock.createContract).toHaveBeenCalledWith({
      projectId: "project-1",
      vendorName: "Firma",
      title: "SOD",
    });
    expect(contractServiceMock.updateContract).toHaveBeenCalledWith("contract-1", { title: "SOD 2" });
    expect(contractServiceMock.createInvoice).toHaveBeenCalledWith({
      contractId: "contract-1",
      invoiceNumber: "FV-1",
      amount: 100,
    });
    expect(contractServiceMock.updateInvoice).toHaveBeenCalledWith("invoice-1", { amount: 200 });
    expect(contractServiceMock.createMarkdownVersion).toHaveBeenCalledWith({
      entityType: "contract",
      contractId: "contract-1",
      sourceKind: "ocr",
      contentMd: "# SOD",
    });
    expect(contractServiceMock.deleteAmendment).toHaveBeenCalledWith("amendment-1");
    expect(contractServiceMock.markInvoicePaid).toHaveBeenCalledWith("invoice-1", "2026-05-06");
    expect(contractServiceMock.deleteInvoice).toHaveBeenCalledWith("invoice-1");
    expect(contractServiceMock.releaseRetention).toHaveBeenCalledWith("contract-1", "short");
  });
});
