import { useEffect, useRef } from "react";
import { invokeAuthedFunction } from "@/services/functionsClient";
import { collectFallbackSuppliers } from "@/shared/dochub/fallbackSelection";
import { ensureStructure } from "@/services/fileSystemService";
import { buildHierarchyTree, ensureExtraHierarchy } from "@/utils/docHub";
import type { Bid, ProjectDetails } from "@/types";
import { getSafeFallbackProjectId as getSafeFallbackProjectIdModel } from "./pipelineModel";

interface UsePipelineDocHubFallbackInput {
  projectId: string;
  projectData: ProjectDetails;
  projectDetails: ProjectDetails;
  bids: Record<string, Bid[]>;
  docHubRoot: string;
  isDocHubEnabled: boolean;
  docHubStructure: ReturnType<typeof import("@/utils/docHub").resolveDocHubStructureV1>;
  userRole?: string;
  fallbackEnabledFlag: boolean;
  activeCategoryId?: string | null;
}

export const usePipelineDocHubFallback = ({
  projectId,
  projectData,
  projectDetails,
  bids,
  docHubRoot,
  isDocHubEnabled,
  docHubStructure,
  userRole,
  fallbackEnabledFlag,
  activeCategoryId,
}: UsePipelineDocHubFallbackInput) => {
  const projectFallbackRunRef = useRef<{ projectId: string | null; done: boolean }>({
    projectId: null,
    done: false,
  });
  const categoryFallbackRunRef = useRef<{ key: string | null }>({ key: null });
  const fallbackInFlightRef = useRef<Set<string>>(new Set());

  const getSafeFallbackProjectId = () =>
    getSafeFallbackProjectIdModel(projectId, projectData.id);

  const isDocHubFallbackEnabled = () => {
    const enabled =
      fallbackEnabledFlag &&
      isDocHubEnabled &&
      docHubRoot.length > 0 &&
      userRole !== "demo" &&
      !!projectData.docHubProvider &&
      !!getSafeFallbackProjectId();

    if (!enabled) {
      console.info("[DocHub fallback] Skipped — conditions not met", {
        fallbackEnabledFlag,
        isDocHubEnabled,
        docHubRootPresent: docHubRoot.length > 0,
        userRole,
        provider: projectData.docHubProvider ?? null,
        safeProjectId: getSafeFallbackProjectId(),
      });
    }

    return enabled;
  };

  const runDocHubFallbackForProject = async (reason: string) => {
    if (!isDocHubFallbackEnabled()) return;

    const fallbackProjectId = getSafeFallbackProjectId();
    if (!fallbackProjectId) {
      console.warn("[DocHub fallback] Skipped due to project mismatch", {
        reason,
        routeProjectId: projectId,
        detailsProjectId: projectData.id,
      });
      return;
    }

    const inFlightKey = `project:${fallbackProjectId}`;
    if (fallbackInFlightRef.current.has(inFlightKey)) return;
    fallbackInFlightRef.current.add(inFlightKey);

    try {
      const { categoriesForEnsure, suppliersByCategory } = collectFallbackSuppliers({
        categories: projectDetails.categories,
        bidsByCategory: bids,
      });

      console.info("[DocHub fallback] Project run", {
        reason,
        projectId: fallbackProjectId,
        categoryCount: categoriesForEnsure.length,
        supplierCountByCategory: Object.fromEntries(
          Object.entries(suppliersByCategory).map(([k, v]) => [k, v.length]),
        ),
        provider: projectData.docHubProvider,
      });

      if (categoriesForEnsure.length === 0) return;

      const provider = projectData.docHubProvider;
      if (provider === "onedrive") {
        const hierarchyTree = buildHierarchyTree(
          ensureExtraHierarchy(docHubStructure.extraHierarchy),
        );
        const result = await ensureStructure({
          rootPath: docHubRoot,
          structure: docHubStructure,
          categories: categoriesForEnsure,
          suppliers: suppliersByCategory,
          hierarchy: hierarchyTree,
        });

        console.info("[DocHub fallback] Project ensureStructure done", {
          reason,
          success: result.success,
          createdCount: result.createdCount,
          reusedCount: result.reusedCount,
          error: result.error,
        });

        if (!result.success) {
          console.error("[DocHub fallback] Project ensureStructure failed", {
            reason,
            provider,
            projectId: fallbackProjectId,
            error: result.error,
          });
        }
        return;
      }

      if (provider === "gdrive" || provider === "onedrive_cloud") {
        await invokeAuthedFunction("dochub-autocreate", {
          body: { projectId: fallbackProjectId },
        });
      }
    } catch (error) {
      console.error("[DocHub fallback] Project fallback failed", {
        reason,
        projectId: fallbackProjectId,
        error,
      });
    } finally {
      fallbackInFlightRef.current.delete(inFlightKey);
    }
  };

  const runDocHubFallbackForCategory = async (
    categoryId: string,
    reason: string,
  ) => {
    if (!isDocHubFallbackEnabled()) return;

    const fallbackProjectId = getSafeFallbackProjectId();
    if (!fallbackProjectId) {
      console.warn(
        "[DocHub fallback] Category fallback skipped due to project mismatch",
        {
          reason,
          routeProjectId: projectId,
          detailsProjectId: projectData.id,
          categoryId,
        },
      );
      return;
    }

    const inFlightKey = `category:${fallbackProjectId}:${categoryId}`;
    if (fallbackInFlightRef.current.has(inFlightKey)) return;
    fallbackInFlightRef.current.add(inFlightKey);

    try {
      const { categoriesForEnsure, suppliersByCategory } = collectFallbackSuppliers({
        categories: projectDetails.categories,
        bidsByCategory: bids,
        categoryIds: [categoryId],
      });

      console.info("[DocHub fallback] Category run", {
        reason,
        projectId: fallbackProjectId,
        categoryId,
        supplierCount: suppliersByCategory[categoryId]?.length ?? 0,
        provider: projectData.docHubProvider,
      });

      if (categoriesForEnsure.length === 0) return;

      const provider = projectData.docHubProvider;
      if (provider === "onedrive") {
        const hierarchyTree = buildHierarchyTree(
          ensureExtraHierarchy(docHubStructure.extraHierarchy),
        );
        const result = await ensureStructure({
          rootPath: docHubRoot,
          structure: docHubStructure,
          categories: categoriesForEnsure,
          suppliers: suppliersByCategory,
          hierarchy: hierarchyTree,
        });

        console.info("[DocHub fallback] Category ensureStructure done", {
          reason,
          categoryId,
          success: result.success,
          createdCount: result.createdCount,
          reusedCount: result.reusedCount,
          error: result.error,
        });

        if (!result.success) {
          console.error("[DocHub fallback] Category ensureStructure failed", {
            reason,
            provider,
            projectId: fallbackProjectId,
            categoryId,
            error: result.error,
          });
        }
        return;
      }

      if (provider === "gdrive" || provider === "onedrive_cloud") {
        const category = categoriesForEnsure[0];
        const suppliers = suppliersByCategory[categoryId] || [];
        if (!category || suppliers.length === 0) return;

        const reconciliationResults = await Promise.allSettled(
          suppliers.map((supplier) =>
            invokeAuthedFunction("dochub-get-link", {
              body: {
                projectId: fallbackProjectId,
                kind: "supplier",
                categoryId: category.id,
                categoryTitle: category.title,
                supplierId: supplier.id,
                supplierName: supplier.name,
              },
            }),
          ),
        );

        const failedCount = reconciliationResults.filter(
          (result) => result.status === "rejected",
        ).length;

        if (failedCount > 0) {
          console.error("[DocHub fallback] Supplier reconciliation partial failure", {
            reason,
            provider,
            projectId: fallbackProjectId,
            categoryId,
            failedCount,
            total: reconciliationResults.length,
          });
        }
      }
    } catch (error) {
      console.error("[DocHub fallback] Category fallback failed", {
        reason,
        projectId: fallbackProjectId,
        categoryId,
        error,
      });
    } finally {
      fallbackInFlightRef.current.delete(inFlightKey);
    }
  };

  useEffect(() => {
    if (projectFallbackRunRef.current.projectId !== projectId) {
      projectFallbackRunRef.current.projectId = projectId;
      projectFallbackRunRef.current.done = false;
    }

    if (projectFallbackRunRef.current.done) return;
    if (!isDocHubFallbackEnabled()) return;

    projectFallbackRunRef.current.done = true;
    void runDocHubFallbackForProject("pipeline-open");
  }, [projectId, isDocHubEnabled, docHubRoot, userRole, projectData.docHubProvider]);

  // Category-level check: whenever the user opens a specific VŘ (pipeline detail),
  // re-verify supplier folders for every bid in that category. This covers the
  // case where a bid was added in another tab / session and the project-level
  // check has already run once for this mount.
  useEffect(() => {
    if (!activeCategoryId) return;
    if (!isDocHubFallbackEnabled()) return;

    const runKey = `${projectId}:${activeCategoryId}`;
    if (categoryFallbackRunRef.current.key === runKey) return;
    categoryFallbackRunRef.current.key = runKey;

    void runDocHubFallbackForCategory(activeCategoryId, "category-open");
  }, [
    activeCategoryId,
    projectId,
    isDocHubEnabled,
    docHubRoot,
    userRole,
    projectData.docHubProvider,
  ]);

  return {
    runDocHubFallbackForCategory,
  };
};
