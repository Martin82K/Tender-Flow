import { contractService } from "@/services/contractService";
import { shellAdapter } from "@/services/platformAdapter";
import type { ContractWithDetails } from "@/types";

export const contractQueriesApi = {
  getContractById(
    ...args: Parameters<typeof contractService.getContractById>
  ): ReturnType<typeof contractService.getContractById> {
    return contractService.getContractById(...args);
  },

  listContractsByProjectIds(projectIds: string[]): Promise<ContractWithDetails[]> {
    return contractService.listContractsByProjectIds(projectIds);
  },

  getContractsByProject(projectId: string): Promise<ContractWithDetails[]> {
    return contractService.getContractsByProject(projectId);
  },

  getContractDocumentUrl(
    ...args: Parameters<typeof contractService.getContractDocumentUrl>
  ): ReturnType<typeof contractService.getContractDocumentUrl> {
    return contractService.getContractDocumentUrl(...args);
  },

  getAmendmentDocumentUrl(
    ...args: Parameters<typeof contractService.getAmendmentDocumentUrl>
  ): ReturnType<typeof contractService.getAmendmentDocumentUrl> {
    return contractService.getAmendmentDocumentUrl(...args);
  },

  async openContractDocument(
    ...args: Parameters<typeof contractService.getContractDocumentUrl>
  ): Promise<void> {
    const url = await contractService.getContractDocumentUrl(...args);
    await shellAdapter.openExternal(url);
  },

  async openAmendmentDocument(
    ...args: Parameters<typeof contractService.getAmendmentDocumentUrl>
  ): Promise<void> {
    const url = await contractService.getAmendmentDocumentUrl(...args);
    await shellAdapter.openExternal(url);
  },

  getMarkdownVersions(
    ...args: Parameters<typeof contractService.getMarkdownVersions>
  ): ReturnType<typeof contractService.getMarkdownVersions> {
    return contractService.getMarkdownVersions(...args);
  },
};
