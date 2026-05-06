import { contractService } from "@/services/contractService";
import type { ContractWithDetails } from "@/types";

export const contractQueriesApi = {
  listContractsByProjectIds(projectIds: string[]): Promise<ContractWithDetails[]> {
    return contractService.listContractsByProjectIds(projectIds);
  },

  getContractsByProject(projectId: string): Promise<ContractWithDetails[]> {
    return contractService.getContractsByProject(projectId);
  },
};
