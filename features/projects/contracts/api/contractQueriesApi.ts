import { contractService } from "@/services/contractService";
import type { ContractWithDetails } from "@/types";

export const contractQueriesApi = {
  listContractsByProjectIds(projectIds: string[]): Promise<ContractWithDetails[]> {
    return contractService.listContractsByProjectIds(projectIds);
  },

  getContractsByProject(projectId: string): Promise<ContractWithDetails[]> {
    return contractService.getContractsByProject(projectId);
  },

  getMarkdownVersions(
    ...args: Parameters<typeof contractService.getMarkdownVersions>
  ): ReturnType<typeof contractService.getMarkdownVersions> {
    return contractService.getMarkdownVersions(...args);
  },
};
