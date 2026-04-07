import type { Bid, BidStatus, DemandCategory, DocHubStructureV1 } from "@/types";
import type { DragEvent } from "react";
import { parseFormattedNumber } from "@/utils/formatters";
import {
  deleteBid,
  updateBid,
  updateBidContracted,
} from "@/features/projects/api";
import { getDemoData, saveDemoData } from "@/services/demoData";
import {
  deleteFolder,
} from "@/services/fileSystemService";
import {
  getDocHubTenderLinks,
  resolveDocHubStructureV1,
} from "@/utils/docHub";
import {
  persistBidStatusChange,
  updateBidStatusInMemory,
} from "./pipelineBidStatusModel";
import {
  emitBidStatusNotification,
  emitBidContractedNotification,
} from "@features/notifications/api/notificationEmitter";

interface UsePipelineBidActionsInput {
  activeCategory: DemandCategory | null;
  bids: Record<string, Bid[]>;
  updateBidsInternal: (
    updater: (prev: Record<string, Bid[]>) => Record<string, Bid[]>,
  ) => void;
  userId?: string;
  userRole?: string;
  projectDataId: string;
  projectName?: string;
  projectDataDocHubProviderLegacy?: string;
  projectDataDocHubStructureV1?: Partial<DocHubStructureV1> | null;
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
  userId,
  userRole,
  projectDataId,
  projectName,
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
      return updateBidStatusInMemory(
        prev,
        activeCategory.id,
        bidId,
        targetStatus,
      );
    });

    try {
      const { error } = await persistBidStatusChange({
        bidId,
        targetStatus,
        userRole,
        projectDataId,
        bidsByCategory: bids,
        activeCategoryId: activeCategory.id,
      });

      if (error) {
        console.error("Error updating bid status:", error);
      } else {
        if (targetStatus === "sent") {
          void runDocHubFallbackForCategory(activeCategory.id, "move-to-sent");
        }
        // Emit notification for bid status change
        if (userId) {
          const bid = (bids[activeCategory.id] || []).find((b) => b.id === bidId);
          void emitBidStatusNotification({
            userId,
            bidId,
            companyName: bid?.companyName ?? "",
            newStatus: targetStatus,
            projectId: projectDataId,
            projectName,
            categoryId: activeCategory.id,
            categoryTitle: activeCategory.title,
          });
        }
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
      } else if (userId) {
        void emitBidContractedNotification({
          userId,
          bidId: bid.id,
          companyName: bid.companyName,
          contracted: newContracted,
          projectId: projectDataId,
          projectName,
          categoryId: activeCategory.id,
          categoryTitle: activeCategory.title,
        });
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
        projectDataDocHubProviderLegacy === "onedrive" &&
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

        deleteFolder(docHubRoot, supplierFolder, { provider: "onedrive" }).catch(
          (folderDeleteError) => {
            console.error(
              "Local auto-delete supplier folder failed:",
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
