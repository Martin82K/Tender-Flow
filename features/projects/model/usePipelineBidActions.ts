import type { Bid, BidStatus, DemandCategory } from "@/types";
import type { DragEvent } from "react";
import { getDemoData, saveDemoData } from "@/services/demoData";
import { parseFormattedNumber } from "@/utils/formatters";
import {
  deleteBid,
  updateBid,
  updateBidContracted,
  updateBidStatus,
} from "@/features/projects/api";
import {
  deleteFolder,
} from "@/services/fileSystemService";
import {
  getDocHubTenderLinks,
  resolveDocHubStructureV1,
} from "@/utils/docHub";

interface UsePipelineBidActionsInput {
  activeCategory: DemandCategory | null;
  bids: Record<string, Bid[]>;
  updateBidsInternal: (
    updater: (prev: Record<string, Bid[]>) => Record<string, Bid[]>,
  ) => void;
  userRole?: string;
  projectDataId: string;
  projectDataDocHubProviderLegacy?: string;
  projectDataDocHubStructureV1?: string;
  isDocHubEnabled: boolean;
  docHubRoot: string;
  runDocHubFallbackForCategory: (
    categoryId: string,
    trigger: "pipeline-open" | "move-to-sent",
  ) => Promise<void> | void;
  onCloseEditBid?: () => void;
}

export const usePipelineBidActions = ({
  activeCategory,
  bids,
  updateBidsInternal,
  userRole,
  projectDataId,
  projectDataDocHubProviderLegacy,
  projectDataDocHubStructureV1,
  isDocHubEnabled,
  docHubRoot,
  runDocHubFallbackForCategory,
  onCloseEditBid,
}: UsePipelineBidActionsInput) => {
  const handleDrop = async (
    e: DragEvent,
    targetStatus: BidStatus,
  ) => {
    e.preventDefault();
    const bidId = e.dataTransfer.getData("bidId");

    if (!activeCategory || !bidId) return;

    updateBidsInternal((prev) => {
      const categoryBids = [...(prev[activeCategory.id] || [])];
      const bidIndex = categoryBids.findIndex((b) => b.id === bidId);

      if (bidIndex > -1 && categoryBids[bidIndex].status !== targetStatus) {
        categoryBids[bidIndex] = {
          ...categoryBids[bidIndex],
          status: targetStatus,
        };
        return { ...prev, [activeCategory.id]: categoryBids };
      }
      return prev;
    });

    try {
      if (userRole === "demo") {
        const demoData = getDemoData();
        if (demoData && demoData.projectDetails[projectDataId]) {
          const projectBids = demoData.projectDetails[projectDataId].bids || {};
          let categoryId = "";
          for (const [catId, catBids] of Object.entries(projectBids)) {
            if ((catBids as Bid[]).some((bid) => bid.id === bidId)) {
              categoryId = catId;
              break;
            }
          }

          if (categoryId) {
            const categoryBids = projectBids[categoryId] || [];
            const index = categoryBids.findIndex((bid: Bid) => bid.id === bidId);
            if (index > -1) {
              categoryBids[index].status = targetStatus;
              projectBids[categoryId] = categoryBids;
              demoData.projectDetails[projectDataId].bids = projectBids;
              saveDemoData(demoData);
            }
          }
        }
        return;
      }

      const { error } = await updateBidStatus(bidId, targetStatus);

      if (error) {
        console.error("Error updating bid status:", error);
      } else if (targetStatus === "sent") {
        void runDocHubFallbackForCategory(activeCategory.id, "move-to-sent");
      }
    } catch (error) {
      console.error("Unexpected error updating bid:", error);
    }
  };

  const handleToggleContracted = async (bid: Bid) => {
    if (!activeCategory) return;

    const newContracted = !bid.contracted;

    updateBidsInternal((prev) => {
      const categoryBids = [...(prev[activeCategory.id] || [])];
      const index = categoryBids.findIndex((item) => item.id === bid.id);
      if (index > -1) {
        categoryBids[index] = {
          ...categoryBids[index],
          contracted: newContracted,
        };
        return { ...prev, [activeCategory.id]: categoryBids };
      }
      return prev;
    });

    try {
      if (userRole === "demo") {
        const demoData = getDemoData();
        if (demoData && demoData.projectDetails[projectDataId]) {
          const projectBids = demoData.projectDetails[projectDataId].bids || {};
          const categoryBids = projectBids[activeCategory.id] || [];
          const index = categoryBids.findIndex((item: Bid) => item.id === bid.id);
          if (index > -1) {
            categoryBids[index].contracted = newContracted;
            projectBids[activeCategory.id] = categoryBids;
            demoData.projectDetails[projectDataId].bids = projectBids;
            saveDemoData(demoData);
          }
        }
        return;
      }

      const { error } = await updateBidContracted(bid.id, newContracted);
      if (error) {
        console.error("Error updating bid contracted status:", error);
      }
    } catch (error) {
      console.error("Unexpected error updating bid:", error);
    }
  };

  const handleSaveBid = async (updatedBid: Bid) => {
    if (!activeCategory) return;

    updateBidsInternal((prev) => {
      const categoryBids = [...(prev[activeCategory.id] || [])];
      const index = categoryBids.findIndex((item) => item.id === updatedBid.id);
      if (index > -1) {
        categoryBids[index] = updatedBid;
        return { ...prev, [activeCategory.id]: categoryBids };
      }
      return prev;
    });
    onCloseEditBid?.();

    const numericPrice = updatedBid.price
      ? parseFormattedNumber(updatedBid.price.replace(/[^\d\s,.-]/g, ""))
      : null;

    try {
      if (userRole === "demo") {
        const demoData = getDemoData();
        if (demoData && demoData.projectDetails[projectDataId]) {
          const projectBids = demoData.projectDetails[projectDataId].bids || {};
          const categoryBids = projectBids[activeCategory.id] || [];
          const index = categoryBids.findIndex(
            (item: Bid) => item.id === updatedBid.id,
          );
          if (index > -1) {
            categoryBids[index] = updatedBid;
            projectBids[activeCategory.id] = categoryBids;
            demoData.projectDetails[projectDataId].bids = projectBids;
            saveDemoData(demoData);
          }
        }
        return;
      }

      const { error } = await updateBid(updatedBid, numericPrice);
      if (error) {
        console.error("Error updating bid:", error);
      }
    } catch (error) {
      console.error("Unexpected error updating bid:", error);
    }
  };

  const handleDeleteBid = async (bidId: string) => {
    if (!activeCategory) return;

    const bidToDelete = (bids[activeCategory.id] || []).find(
      (bid) => bid.id === bidId,
    );

    updateBidsInternal((prev) => {
      const categoryBids = (prev[activeCategory.id] || []).filter(
        (bid) => bid.id !== bidId,
      );
      return { ...prev, [activeCategory.id]: categoryBids };
    });

    try {
      if (userRole === "demo") {
        const demoData = getDemoData();
        if (demoData && demoData.projectDetails[projectDataId]) {
          const projectBids = demoData.projectDetails[projectDataId].bids || {};
          projectBids[activeCategory.id] = (
            projectBids[activeCategory.id] || []
          ).filter((bid: Bid) => bid.id !== bidId);
          demoData.projectDetails[projectDataId].bids = projectBids;
          saveDemoData(demoData);
        }
        return;
      }

      const { error } = await deleteBid(bidId);
      if (error) {
        console.error("Error deleting bid:", error);
        return;
      }

      if (
        bidToDelete &&
        isDocHubEnabled &&
        projectDataDocHubProviderLegacy === "mcp" &&
        docHubRoot
      ) {
        const structure = resolveDocHubStructureV1(
          projectDataDocHubStructureV1 || undefined,
        );
        const links = getDocHubTenderLinks(
          docHubRoot,
          activeCategory.title,
          structure,
        );
        const supplierFolder = links.supplierBase(bidToDelete.companyName);

        deleteFolder(docHubRoot, supplierFolder, { provider: "mcp" }).catch(
          (folderDeleteError) => {
            console.error(
              "MCP Auto-delete supplier folder failed:",
              folderDeleteError,
            );
          },
        );
      }
    } catch (error) {
      console.error("Unexpected error deleting bid:", error);
    }
  };

  return {
    handleDrop,
    handleToggleContracted,
    handleSaveBid,
    handleDeleteBid,
  };
};
