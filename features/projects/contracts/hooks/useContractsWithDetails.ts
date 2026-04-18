import { useCallback, useEffect, useState } from 'react';
import { contractService } from '@/services/contractService';
import type { ContractWithDetails } from '@/types';

export interface UseContractsWithDetailsResult {
  contracts: ContractWithDetails[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useContractsWithDetails = (
  projectId: string,
): UseContractsWithDetailsResult => {
  const [contracts, setContracts] = useState<ContractWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await contractService.getContractsByProject(projectId);
      setContracts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst smlouvy');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return { contracts, loading, error, refresh: load };
};
