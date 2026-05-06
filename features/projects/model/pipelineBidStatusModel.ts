import { updateBidStatus } from "@/features/projects/api";
import { projectDemoDataApi } from "@features/projects/api/projectDemoDataApi";
import type { Bid, BidStatus } from "@/types";

interface PersistBidStatusChangeInput {
  bidId: string;
  targetStatus: BidStatus;
  userRole?: string;
  projectDataId: string;
  bidsByCategory?: Record<string, Bid[]>;
  activeCategoryId?: string;
}

export const updateBidStatusInMemory = (
  bidsByCategory: Record<string, Bid[]>,
  categoryId: string,
  bidId: string,
  targetStatus: BidStatus,
) => {
  const categoryBids = [...(bidsByCategory[categoryId] || [])];
  const bidIndex = categoryBids.findIndex((bid) => bid.id === bidId);

  if (bidIndex === -1 || categoryBids[bidIndex].status === targetStatus) {
    return bidsByCategory;
  }

  categoryBids[bidIndex] = {
    ...categoryBids[bidIndex],
    status: targetStatus,
  };

  return {
    ...bidsByCategory,
    [categoryId]: categoryBids,
  };
};

export const persistBidStatusChange = async ({
  bidId,
  targetStatus,
  userRole,
  projectDataId,
  bidsByCategory,
  activeCategoryId,
}: PersistBidStatusChangeInput) => {
  if (userRole === "demo") {
    const demoData = projectDemoDataApi.getDemoData();

    if (!demoData || !demoData.projectDetails[projectDataId]) {
      return { error: null };
    }

    const projectBids = demoData.projectDetails[projectDataId].bids || {};
    const categoryId =
      activeCategoryId ||
      Object.entries(projectBids).find(([, categoryBids]) =>
        (categoryBids as Bid[]).some((bid) => bid.id === bidId),
      )?.[0];

    if (!categoryId) {
      return { error: null };
    }

    const nextBids = updateBidStatusInMemory(
      projectBids,
      categoryId,
      bidId,
      targetStatus,
    );

    demoData.projectDetails[projectDataId].bids = nextBids;
    projectDemoDataApi.saveDemoData(demoData);
    return { error: null };
  }

  if (!bidsByCategory || !activeCategoryId) {
    return {
      error: new Error("Missing pipeline context for bid status persistence."),
    };
  }

  return updateBidStatus(bidId, targetStatus);
};
