import { beforeEach, describe, expect, it, vi } from "vitest";

const contractServiceMock = vi.hoisted(() => ({
  getContractById: vi.fn(),
  getContractsByProject: vi.fn(),
  getMarkdownVersions: vi.fn(),
  listContractsByProjectIds: vi.fn(),
}));

vi.mock("@/services/contractService", () => ({
  contractService: contractServiceMock,
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

    await expect(contractQueriesApi.getContractById("contract-1")).resolves.toBe(contract);
    await expect(contractQueriesApi.listContractsByProjectIds(["project-2", "project-1"])).resolves.toBe(contracts);
    await expect(contractQueriesApi.getContractsByProject("project-1")).resolves.toBe(contracts);
    await expect(contractQueriesApi.getMarkdownVersions({ entityType: "contract", entityId: "contract-1" })).resolves.toBe(markdownVersions);

    expect(contractServiceMock.getContractById).toHaveBeenCalledWith("contract-1");
    expect(contractServiceMock.listContractsByProjectIds).toHaveBeenCalledWith(["project-2", "project-1"]);
    expect(contractServiceMock.getContractsByProject).toHaveBeenCalledWith("project-1");
    expect(contractServiceMock.getMarkdownVersions).toHaveBeenCalledWith({
      entityType: "contract",
      entityId: "contract-1",
    });
  });
});
