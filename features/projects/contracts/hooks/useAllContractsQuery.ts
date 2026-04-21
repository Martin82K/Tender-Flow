import { useQuery } from '@tanstack/react-query';
import { contractService } from '@/services/contractService';
import type { ContractWithDetails } from '@/types';

export const ALL_CONTRACTS_QUERY_KEY = ['contracts', 'all'] as const;

export const useAllContractsQuery = (projectIds: string[], enabled: boolean = true) => {
  const sortedIds = [...projectIds].sort();
  return useQuery<ContractWithDetails[]>({
    queryKey: [...ALL_CONTRACTS_QUERY_KEY, sortedIds.join(',')],
    queryFn: () => contractService.listContractsByProjectIds(sortedIds),
    enabled: enabled && sortedIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
};
