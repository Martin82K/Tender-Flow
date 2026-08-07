import { useCallback, useEffect, useRef, useState } from 'react';
import { contractQueriesApi } from '../api';
import type { ContractWithDetails } from '@/types';

export interface UseContractsWithDetailsResult {
  contracts: ContractWithDetails[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useContractsWithDetails = (
  projectId: string,
  enabled: boolean = true,
): UseContractsWithDetailsResult => {
  const [contracts, setContracts] = useState<ContractWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) {
      requestIdRef.current += 1;
      setLoading(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    try {
      setError(null);
      const data = await contractQueriesApi.getContractsByProject(projectId);
      if (requestId !== requestIdRef.current) return;
      setContracts(data);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst smlouvy');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [enabled, projectId]);

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current += 1;
      setContracts([]);
      setError(null);
      setLoading(false);
      return;
    }
    setContracts([]);
    setLoading(true);
    void load();
  }, [enabled, load]);

  return { contracts, loading, error, refresh: load };
};
