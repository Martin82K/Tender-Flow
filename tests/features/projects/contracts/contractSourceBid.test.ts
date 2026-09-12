import { describe, expect, it } from 'vitest';
import { findContractSourceBid } from '@/features/projects/contracts/model/contractSourceBid';
import type { ProjectDetails, ContractWithDetails } from '@/types';
const project = { id: 'p1', categories: [{ id: 'cat', title: 'VŘ' }], bids: { cat: [{ id: 'b1' }] } } as unknown as ProjectDetails;
const contract = { projectId: 'p1', sourceBidId: 'b1' } as ContractWithDetails;
describe('findContractSourceBid', () => {
  it('resolves the exact category and bid, never a vendor name', () => {
    expect(findContractSourceBid(contract, project)).toEqual({ categoryId: 'cat', bidId: 'b1', title: 'VŘ' });
    expect(findContractSourceBid({ ...contract, sourceBidId: undefined }, project)).toBeNull();
  });
  it('refuses another project and a deleted bid', () => {
    expect(findContractSourceBid({ ...contract, projectId: 'p2' }, project)).toBeNull();
    expect(findContractSourceBid({ ...contract, sourceBidId: 'deleted' }, project)).toBeNull();
  });
});
