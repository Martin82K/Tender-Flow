import { useEffect, useRef, useState } from "react";
import type { DemandCategory, DocHubStructureV1 } from "@/types";
import { folderExists } from "@infra/files/fileSystemService";
import {
  getTendersFolderName,
  joinDocHubPath,
  slugifyDocHubSegmentStrict,
} from "@/shared/dochub/docHub";
import { sanitizeSubcontractorCompanyName } from "@/shared/dochub/subcontractorNameRules";

interface UsePipelineCategoryNavigationInput {
  projectId: string;
  initialOpenCategoryId?: string;
  categories: DemandCategory[];
  docHubRoot: string;
  docHubStructureV1?: Partial<DocHubStructureV1> | null;
}

export const getDesktopTenderFolderPath = (
  docHubRoot: string,
  categoryTitle: string,
  docHubStructureV1?: Partial<DocHubStructureV1> | null,
): string => {
  const tendersFolder = getTendersFolderName(docHubStructureV1);
  const filesystemTitle = sanitizeSubcontractorCompanyName(
    categoryTitle,
  ).sanitized;
  return joinDocHubPath(docHubRoot, tendersFolder, filesystemTitle);
};

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

  const resolveDesktopTenderFolderPath = async (
    categoryTitle: string,
  ): Promise<string | null> => {
    if (!docHubRoot) return null;

    const tendersFolder = getTendersFolderName(docHubStructureV1);
    const rawPath = getDesktopTenderFolderPath(
      docHubRoot,
      categoryTitle,
      docHubStructureV1,
    );

    if (await folderExists(rawPath)) return rawPath;

    const strictPath = joinDocHubPath(
      docHubRoot,
      tendersFolder,
      slugifyDocHubSegmentStrict(categoryTitle),
    );
    if (strictPath !== rawPath && (await folderExists(strictPath))) {
      return strictPath;
    }

    return null;
  };

  return {
    activeCategory,
    setActiveCategory,
    resolveDesktopTenderFolderPath,
  };
};
