import type { Bid, ContractWithDetails } from '@/types';

export type ContractBidMatch = 'sourceBidId' | 'vendorId' | null;

export interface ContractBidLinkResult {
  contract: ContractWithDetails | null;
  match: ContractBidMatch;
  ambiguous: boolean;
}

export const resolveBidContractLink = (
  bid: Pick<Bid, 'id' | 'subcontractorId'>,
  contracts: ContractWithDetails[],
): ContractBidLinkResult => {
  const directMatches = contracts.filter((contract) => contract.sourceBidId === bid.id);
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
    (contract) => !contract.sourceBidId && contract.vendorId === bid.subcontractorId,
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
