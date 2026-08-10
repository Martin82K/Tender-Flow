import { beforeEach, describe, expect, it, vi } from "vitest";

const contractServiceMock = vi.hoisted(() => ({
  getContractById: vi.fn(),
  getContractsByProject: vi.fn(),
  getMarkdownVersions: vi.fn(),
  getContractDocumentUrl: vi.fn(),
  getAmendmentDocumentUrl: vi.fn(),
  listContractsByProjectIds: vi.fn(),
}));

const shellAdapterMock = vi.hoisted(() => ({
  openExternal: vi.fn(),
}));

vi.mock("@/services/contractService", () => ({
  contractService: contractServiceMock,
}));

vi.mock("@/services/platformAdapter", () => ({
  shellAdapter: shellAdapterMock,
}));

import { contractQueriesApi } from "../features/projects/contracts/api";

describe("contractQueriesApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deleguje contract query metody do legacy service", async () => {
    const contracts = [{ id: "contract-1" }];
    const contract = { id: "contract-1" };
    const markdownVersions = [{ id: "markdown-1" }];
    contractServiceMock.getContractById.mockResolvedValue(contract);
    contractServiceMock.listContractsByProjectIds.mockResolvedValue(contracts);
    contractServiceMock.getContractsByProject.mockResolvedValue(contracts);
    contractServiceMock.getMarkdownVersions.mockResolvedValue(markdownVersions);
    contractServiceMock.getContractDocumentUrl.mockResolvedValue('https://signed.example/document.pdf');
    contractServiceMock.getAmendmentDocumentUrl.mockResolvedValue('https://signed.example/amendment.pdf');

    await expect(contractQueriesApi.getContractById("contract-1")).resolves.toBe(contract);
    await expect(contractQueriesApi.listContractsByProjectIds(["project-2", "project-1"])).resolves.toBe(contracts);
    await expect(contractQueriesApi.getContractsByProject("project-1")).resolves.toBe(contracts);
    await expect(contractQueriesApi.getMarkdownVersions({ entityType: "contract", entityId: "contract-1" })).resolves.toBe(markdownVersions);
    await expect(contractQueriesApi.getContractDocumentUrl({ documentStoragePath: 'projects/p/contracts/x.pdf' })).resolves.toBe('https://signed.example/document.pdf');
    await expect(contractQueriesApi.getAmendmentDocumentUrl({ documentStoragePath: 'projects/p/contracts/a.pdf' })).resolves.toBe('https://signed.example/amendment.pdf');

    expect(contractServiceMock.getContractById).toHaveBeenCalledWith("contract-1");
    expect(contractServiceMock.listContractsByProjectIds).toHaveBeenCalledWith(["project-2", "project-1"]);
    expect(contractServiceMock.getContractsByProject).toHaveBeenCalledWith("project-1");
    expect(contractServiceMock.getMarkdownVersions).toHaveBeenCalledWith({
      entityType: "contract",
      entityId: "contract-1",
    });
    expect(contractServiceMock.getContractDocumentUrl).toHaveBeenCalledWith({
      documentStoragePath: 'projects/p/contracts/x.pdf',
    });
    expect(contractServiceMock.getAmendmentDocumentUrl).toHaveBeenCalledWith({
      documentStoragePath: 'projects/p/contracts/a.pdf',
    });
  });

  it("otevře privátní dokumenty přes bezpečný platformní adaptér", async () => {
    const contract = { documentStoragePath: "projects/p/contracts/x.pdf" };
    const amendment = { documentStoragePath: "projects/p/contracts/a.pdf" };
    contractServiceMock.getContractDocumentUrl.mockResolvedValue("https://signed.example/document.pdf");
    contractServiceMock.getAmendmentDocumentUrl.mockResolvedValue("https://signed.example/amendment.pdf");

    await contractQueriesApi.openContractDocument(contract);
    await contractQueriesApi.openAmendmentDocument(amendment);

    expect(shellAdapterMock.openExternal).toHaveBeenNthCalledWith(
      1,
      "https://signed.example/document.pdf",
    );
    expect(shellAdapterMock.openExternal).toHaveBeenNthCalledWith(
      2,
      "https://signed.example/amendment.pdf",
    );
  });
});
