import { contractBidIds } from './contractBidLink';
import type { ContractWithDetails, ProjectDetails } from '@/types';

export const findContractSourceBid = (contract: ContractWithDetails, project?: ProjectDetails) => {
  if (!project || project.id !== contract.projectId) return null;
  const ids = contractBidIds(contract);
  const bidId = contract.sourceBidId && ids.includes(contract.sourceBidId) ? contract.sourceBidId : ids.length === 1 ? ids[0] : undefined;
  if (!bidId) return null;
  const matches = (project.categories || []).filter(category =>
    (project.bids?.[category.id] || []).some(bid => bid.id === bidId));
  if (matches.length !== 1) return null;
  return { categoryId: matches[0].id, bidId, title: matches[0].title };
};

export const findContractLinkedBids = (contract: ContractWithDetails, project?: ProjectDetails) => {
  if (!project || project.id !== contract.projectId) return [];
  return contractBidIds(contract).flatMap(bidId => {
    const matches = (project.categories || []).filter(category =>
      (project.bids?.[category.id] || []).some(bid => bid.id === bidId));
    return matches.length === 1 ? [{ categoryId: matches[0].id, bidId, title: matches[0].title }] : [];
  });
};
