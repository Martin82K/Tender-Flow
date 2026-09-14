import type { Bid, Contract, ContractWithDetails } from '@/types';

export const contractBidIds = (contract: Pick<Contract, 'linkedBidIds' | 'sourceBidId'>): string[] =>
  contract.linkedBidIds ?? (contract.sourceBidId ? [contract.sourceBidId] : []);

export const isContractLinkedToBid = (contract: Contract, bidId: string): boolean => contractBidIds(contract).includes(bidId);

export type ContractBidMatch = 'sourceBidId' | 'vendorId' | null;

export interface ContractBidLinkResult {
  contract: ContractWithDetails | null;
  match: ContractBidMatch;
  ambiguous: boolean;
}

export const resolveBidContractLink = (
  bid: Pick<Bid, 'id' | 'subcontractorId'>,
  contracts: ContractWithDetails[],
  categoryBidIds: readonly string[] = [bid.id],
): ContractBidLinkResult => {
  const directMatches = contracts.filter((contract) =>
    contractBidIds(contract).some((id) => id === bid.id || categoryBidIds.includes(id)),
  );
  if (directMatches.length === 1) {
    return { contract: directMatches[0], match: 'sourceBidId', ambiguous: false };
  }
  if (directMatches.length > 1) {
    return { contract: null, match: null, ambiguous: true };
  }

  if (!bid.subcontractorId) {
    return { contract: null, match: null, ambiguous: false };
  }

  const vendorMatches = contracts.filter(
    (contract) => contractBidIds(contract).length === 0 && contract.vendorId === bid.subcontractorId,
  );
  if (vendorMatches.length === 1) {
    return { contract: vendorMatches[0], match: 'vendorId', ambiguous: false };
  }

  return {
    contract: null,
    match: null,
    ambiguous: vendorMatches.length > 1,
  };
};
