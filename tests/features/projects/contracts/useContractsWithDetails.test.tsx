import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractWithDetails } from '@/types';

const { getContractsByProject } = vi.hoisted(() => ({
  getContractsByProject: vi.fn(),
}));
vi.mock('@/features/projects/contracts/api', () => ({
  contractQueriesApi: { getContractsByProject },
}));

import { useContractsWithDetails } from '@/features/projects/contracts/hooks/useContractsWithDetails';

const contract = (id: string, projectId: string): ContractWithDetails => ({
  id,
  projectId,
  vendorName: 'Dodavatel',
  title: id,
  status: 'active',
  currency: 'CZK',
  basePrice: 1,
  source: 'manual',
  amendments: [],
  drawdowns: [],
  invoices: [],
  currentTotal: 1,
  approvedSum: 0,
  remaining: 1,
  invoicedSum: 0,
  paidSum: 0,
  overdueSum: 0,
});

describe('useContractsWithDetails', () => {
  beforeEach(() => {
    getContractsByProject.mockReset();
  });

  it('ignoruje opožděnou odpověď předchozí stavby', async () => {
    let resolveProjectOne: (value: ContractWithDetails[]) => void = () => undefined;
    getContractsByProject.mockImplementation((projectId: string) => {
      if (projectId === 'project-1') {
        return new Promise<ContractWithDetails[]>((resolve) => {
          resolveProjectOne = resolve;
        });
      }
      return Promise.resolve([contract('contract-2', 'project-2')]);
    });

    const { result, rerender } = renderHook(
      ({ projectId }) => useContractsWithDetails(projectId),
      { initialProps: { projectId: 'project-1' } },
    );

    rerender({ projectId: 'project-2' });
    await waitFor(() => expect(result.current.contracts.map((item) => item.id)).toEqual(['contract-2']));

    await act(async () => resolveProjectOne([contract('contract-1', 'project-1')]));
    expect(result.current.contracts.map((item) => item.id)).toEqual(['contract-2']);
  });

  it('ignoruje opožděnou odpověď po odpojení komponenty', async () => {
    let resolveRequest: (value: ContractWithDetails[]) => void = () => undefined;
    getContractsByProject.mockImplementation(() => new Promise<ContractWithDetails[]>((resolve) => {
      resolveRequest = resolve;
    }));

    const { unmount } = renderHook(() => useContractsWithDetails('project-1'));
    expect(getContractsByProject).toHaveBeenCalledWith('project-1');

    resolveRequest([contract('contract-1', 'project-1')]);
    unmount();
    await Promise.resolve();
    await Promise.resolve();
  });
});
