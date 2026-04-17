import { useEffect, useRef, useState } from "react";
import type { DemandCategory, DocHubStructureV1 } from "@/types";
import { folderExists } from "@/services/fileSystemService";
import { logIncident } from "@/services/incidentLogger";
import platformAdapter from "@/services/platformAdapter";
import {
  getTendersFolderName,
  joinDocHubPath,
  slugifyDocHubSegmentStrict,
} from "@/utils/docHub";
import { sanitizeFolderSegment } from "./pipelineModel";

interface UsePipelineCategoryNavigationInput {
  projectId: string;
  initialOpenCategoryId?: string;
  categories: DemandCategory[];
  docHubRoot: string;
  docHubStructureV1?: Partial<DocHubStructureV1> | null;
}

export const usePipelineCategoryNavigation = ({
  projectId,
  initialOpenCategoryId,
  categories,
  docHubRoot,
  docHubStructureV1,
}: UsePipelineCategoryNavigationInput) => {
  const [activeCategory, setActiveCategory] = useState<DemandCategory | null>(
    null,
  );
  const [isBidComparisonPanelOpen, setIsBidComparisonPanelOpen] =
    useState(false);
  const [bidComparisonTenderPath, setBidComparisonTenderPath] = useState<
    string | null
  >(null);
  const [isResolvingBidComparisonPath, setIsResolvingBidComparisonPath] =
    useState(false);

  const prevProjectIdRef = useRef<string | null>(null);
  const prevCategoryIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const projectActuallyChanged =
      prevProjectIdRef.current !== null &&
      prevProjectIdRef.current !== projectId;
    const categoryIdChanged = prevCategoryIdRef.current !== initialOpenCategoryId;

    prevProjectIdRef.current = projectId;
    prevCategoryIdRef.current = initialOpenCategoryId;

    if (initialOpenCategoryId) {
      const categoryToOpen = categories.find((c) => c.id === initialOpenCategoryId);
      if (categoryToOpen) {
        setActiveCategory(categoryToOpen);
      }
    } else if (projectActuallyChanged || categoryIdChanged) {
      setActiveCategory(null);
    }
  }, [projectId, initialOpenCategoryId, categories]);

  useEffect(() => {
    setIsBidComparisonPanelOpen(false);
    setBidComparisonTenderPath(null);
    setIsResolvingBidComparisonPath(false);
  }, [activeCategory?.id]);

  const resolveDesktopTenderFolderPath = async (
    categoryTitle: string,
  ): Promise<string | null> => {
    if (!docHubRoot) return null;

    const tendersFolder = getTendersFolderName(docHubStructureV1);
    const cleanedTitle = sanitizeFolderSegment(categoryTitle);
    if (!cleanedTitle) return null;

    const rawPath = joinDocHubPath(docHubRoot, tendersFolder, cleanedTitle);
    if (await folderExists(rawPath)) {
      return rawPath;
    }

    const strictPath = joinDocHubPath(
      docHubRoot,
      tendersFolder,
      slugifyDocHubSegmentStrict(categoryTitle),
    );

    if (strictPath !== rawPath && (await folderExists(strictPath))) {
      return strictPath;
    }

    return rawPath;
  };

  const handleOpenBidComparisonPanel = async () => {
    if (!activeCategory) return;

    setIsBidComparisonPanelOpen(true);
    setBidComparisonTenderPath(null);

    if (!platformAdapter.isDesktop) return;

    setIsResolvingBidComparisonPath(true);
    try {
      const resolvedPath = await resolveDesktopTenderFolderPath(
        activeCategory.title,
      );
      setBidComparisonTenderPath(resolvedPath);
    } catch (error) {
      console.error("[BidComparison] Nelze dopočítat cestu složky VŘ:", error);
      void logIncident({
        severity: "error",
        source: "renderer",
        category: "storage",
        code: "BID_COMPARISON_PATH_RESOLVE_FAILED",
        message: `Nelze dopočítat cestu ke složce VŘ: ${error instanceof Error ? error.message : String(error)}`,
        stack: error instanceof Error ? error.stack : null,
        context: {
          action: "resolve_bid_comparison_path",
          operation: "pipeline.resolve_desktop_tender_folder_path",
          project_id: projectId,
          category_id: activeCategory.id,
          reason: error instanceof Error ? error.message : String(error),
          action_status: "error",
        },
      });
      setBidComparisonTenderPath(null);
    } finally {
      setIsResolvingBidComparisonPath(false);
    }
  };

  return {
    activeCategory,
    setActiveCategory,
    isBidComparisonPanelOpen,
    setIsBidComparisonPanelOpen,
    bidComparisonTenderPath,
    isResolvingBidComparisonPath,
    resolveDesktopTenderFolderPath,
    handleOpenBidComparisonPanel,
  };
};
