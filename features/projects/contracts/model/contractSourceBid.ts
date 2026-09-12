import type { ContractWithDetails, ProjectDetails } from '@/types';

export const findContractSourceBid = (contract: ContractWithDetails, project?: ProjectDetails) => {
  if (!project || project.id !== contract.projectId || !contract.sourceBidId) return null;
  const matches = (project.categories || []).filter(category =>
    (project.bids?.[category.id] || []).some(bid => bid.id === contract.sourceBidId));
  if (matches.length !== 1) return null;
  return { categoryId: matches[0].id, bidId: contract.sourceBidId, title: matches[0].title };
};
