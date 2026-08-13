import { invokeAuthedFunction } from "@infra/functions/functionsClient";
import { folderExists, openInExplorer } from "@infra/files/fileSystemService";
import { logIncident } from "@infra/diagnostics/incidentLogger";
import platformAdapter from "@infra/platform/platformAdapter";
import {
  getDocHubTenderLinks,
  getDocHubTenderLinksDesktop,
  isProbablyUrl,
  slugifyDocHubSegmentStrict,
} from "@/shared/dochub/docHub";
import { hasDocHubOnlineFallback } from "@shared/dochub/cloudConnection";
import {
  buildSharePointFolderUrl,
  isSharePointSharingUrl,
  normalizeDocHubOnlineUrl,
} from "@shared/dochub/personalLocation";
import { getDesktopTenderFolderPath } from "./usePipelineCategoryNavigation";
import type { Bid, DemandCategory, ProjectDetails } from "@/types";

interface ShowAlertArgs {
  title: string;
  message: string;
  variant?: "danger" | "info" | "success";
  copyableText?: string;
}

interface UsePipelineDocHubActionsInput {
  activeCategory: DemandCategory | null;
  projectData: ProjectDetails;
  projectDetails: ProjectDetails;
  docHubRoot: string;
  docHubStructure: ReturnType<typeof import("@/shared/dochub/docHub").resolveDocHubStructureV1>;
  isDocHubEnabled: boolean;
  showAlert: (args: ShowAlertArgs) => void;
  resolveDesktopTenderFolderPath: (categoryTitle: string) => Promise<string | null>;
}

export const usePipelineDocHubActions = ({
  activeCategory,
  projectData,
  projectDetails,
  docHubRoot,
  docHubStructure,
  isDocHubEnabled,
  showAlert,
  resolveDesktopTenderFolderPath,
}: UsePipelineDocHubActionsInput) => {
  const canUseDocHubBackend = Boolean(
    hasDocHubOnlineFallback(projectDetails) &&
    projectDetails.docHubStatus !== "disconnected" &&
    projectDetails.docHubStatus !== "error",
  );

  const openDocHubPath = async (path: string): Promise<boolean> => {
    console.log("[DocHub] openOrCopyDocHubPath called with path:", path);
    if (!path) {
      console.warn("[DocHub] Empty path, returning");
      return false;
    }
    if (isProbablyUrl(path)) {
      console.log("[DocHub] Path is URL, opening in browser");
      try {
        await platformAdapter.shell.openExternal(path);
        return true;
      } catch (error) {
        console.warn("[DocHub] Online URL open failed", error);
        return false;
      }
    }

    console.log(
      "[DocHub] Attempting to open local path. isDocHubEnabled:",
      isDocHubEnabled,
    );
    if (isDocHubEnabled && !isProbablyUrl(path)) {
      try {
        console.log("[DocHub] isDesktop:", platformAdapter.isDesktop);
        if (platformAdapter.isDesktop) {
          console.log(
            "[DocHub] Calling openInExplorer with path:",
            path,
          );
          const result = await openInExplorer(path);
          if (result.success) {
            console.log("[DocHub] openInExplorer completed successfully");
            return true;
          }
          throw new Error(result.error || "Nepodařilo se otevřít cestu v průzkumníku.");
        }

      } catch (error) {
        console.warn("[DocHub] Open failed, falling back online", error);
        void logIncident({
          severity: "warn",
          source: "renderer",
          category: "storage",
          code: "DOCHUB_OPEN_PATH_FALLBACK",
          message: `Otevření DocHub cesty selhalo, přecházím na online variantu: ${error instanceof Error ? error.message : String(error)}`,
          stack: error instanceof Error ? error.stack : null,
          context: {
            action: "open_doc_hub_path",
            operation: "dochub.open_or_copy_path",
            provider: projectDetails.docHubProvider ?? null,
            project_id: projectData.id ?? null,
            category_id: activeCategory?.id ?? null,
            folder_path: path,
            reason: error instanceof Error ? error.message : String(error),
            action_status: "fallback",
          },
        });
      }
    }
    return false;
  };

  const copyDocHubPath = async (path: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(path);
      showAlert({
        title: "Zkopírováno",
        message: path,
        variant: "success",
      });
    } catch {
      showAlert({
        title: "Kopírování selhalo",
        message: "Automatické kopírování selhalo. Zkopírujte cestu ručně:",
        variant: "info",
        copyableText: path,
      });
    }
  };

  const openDocHubBackendLink = async (payload: Record<string, unknown>): Promise<boolean> => {
    try {
      const data = await invokeAuthedFunction<{ webUrl?: string }>("dochub-get-link", {
        body: payload,
      });
      const webUrl = normalizeDocHubOnlineUrl(data?.webUrl || "");
      if (!webUrl) throw new Error("Backend nevrátil bezpečný odkaz na podporované úložiště");
      await platformAdapter.shell.openExternal(webUrl);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Neznámá chyba";
      void logIncident({
        severity: "error",
        source: "renderer",
        category: "network",
        code: "DOCHUB_BACKEND_LINK_FAILED",
        message: `Načtení DocHub odkazu selhalo: ${message}`,
        stack: error instanceof Error ? error.stack : null,
        context: {
          action: "open_doc_hub_backend_link",
          operation: "dochub.open_backend_link",
          provider: projectData.docHubProvider ?? null,
          project_id: projectData.id ?? null,
          category_id: activeCategory?.id ?? null,
          function_name: "dochub-get-link",
          reason: message,
          action_status: "error",
        },
      });
      return false;
    }
  };

  const openMappedSharePointFolder = (relativePath: string): boolean => {
    const webUrl = buildSharePointFolderUrl(
      projectDetails.docHubRootWebUrl,
      relativePath,
    );
    if (!webUrl) return false;
    window.open(webUrl, "_blank", "noopener,noreferrer");
    return true;
  };

  const showUnavailableFolder = () => {
    const hasOpaqueSharePointRoot = isSharePointSharingUrl(
      projectDetails.docHubRootWebUrl,
    );
    showAlert({
      title: "Složka není dostupná",
      message: hasOpaqueSharePointRoot
        ? "Uložený online kořen je pouze sdílecí odkaz SharePointu. Vlastník projektu musí otevřít kořen, zkopírovat finální adresu OneDrive s parametrem id a uložit ji ve Složkomatu jako online odkaz."
        : "Lokální složka není dostupná a online odkaz se nepodařilo otevřít.",
      variant: "danger",
    });
  };

  const handleOpenSupplierDocHub = async (bid: Bid): Promise<void> => {
    console.log("[DocHub] handleOpenSupplierDocHub called", {
      bid: bid.companyName,
      isDocHubEnabled,
      docHubRoot,
      activeCategory: activeCategory?.title,
      docHubProvider: projectData.docHubProvider,
      docHubStructure,
    });

    if (!isDocHubEnabled || !activeCategory) {
      console.warn(
        "[DocHub] Early exit: isDocHubEnabled=",
        isDocHubEnabled,
        "activeCategory=",
        activeCategory,
      );
      return;
    }

    const isLocalProvider = projectData.docHubProvider === "onedrive" ||
      projectData.docHubProvider === "local";

    const isDesktopMode = platformAdapter.isDesktop;
    console.log("[DocHub] isDesktopMode:", isDesktopMode);
    let localFallbackPath: string | null = null;

    if (isDesktopMode && isLocalProvider && docHubRoot) {
      const supplierPath = getDocHubTenderLinksDesktop(
        docHubRoot,
        activeCategory.title,
        bid.companyName,
        projectDetails.docHubStructureV1,
      );
      localFallbackPath = supplierPath;

      if (await folderExists(supplierPath)) {
        console.log("[DocHub] Found aligned folder:", supplierPath);
        if (await openDocHubPath(supplierPath)) return;
      }

      const strictName = slugifyDocHubSegmentStrict(bid.companyName);
      const strictPath = getDocHubTenderLinksDesktop(
        docHubRoot,
        activeCategory.title,
        strictName,
        projectDetails.docHubStructureV1,
      );

      if (await folderExists(strictPath)) {
        console.log("[DocHub] Found strict (underscored) folder:", strictPath);
        localFallbackPath = strictPath;
        if (await openDocHubPath(strictPath)) return;
      }
    }

    if (canUseDocHubBackend && projectData.id) {
      const opened = await openDocHubBackendLink({
        projectId: projectData.id,
        kind: "supplier",
        categoryId: activeCategory.id,
        categoryTitle: activeCategory.title,
        supplierId: bid.subcontractorId,
        supplierName: bid.companyName,
      });
      if (opened) return;
    }

    const onlineSupplierPath = getDocHubTenderLinksDesktop(
      "",
      activeCategory.title,
      bid.companyName,
      projectDetails.docHubStructureV1,
    );
    if (openMappedSharePointFolder(onlineSupplierPath)) return;

    if (!isLocalProvider && docHubRoot && !isProbablyUrl(docHubRoot)) {
      const links = getDocHubTenderLinks(
        docHubRoot,
        activeCategory.title,
        docHubStructure,
      );
      if (await openDocHubPath(links.supplierBase(bid.companyName))) return;
    }

    if (localFallbackPath) {
      await copyDocHubPath(localFallbackPath);
      return;
    }

    showUnavailableFolder();
  };

  const handleOpenTenderDocHub = async () => {
    if (!isDocHubEnabled || !activeCategory) return;

    const isDesktopMode = platformAdapter.isDesktop;

    const isLocalProvider = projectData.docHubProvider === "onedrive" ||
      projectData.docHubProvider === "local";
    let localFallbackPath: string | null = null;
    if (isDesktopMode && isLocalProvider && docHubRoot) {
      const tenderPath = await resolveDesktopTenderFolderPath(activeCategory.title);
      localFallbackPath = tenderPath || getDesktopTenderFolderPath(
        docHubRoot,
        activeCategory.title,
        projectDetails.docHubStructureV1,
      );
      if (tenderPath) {
        console.log("[DocHub] Opening tender folder:", tenderPath);
        if (await openDocHubPath(tenderPath)) return;
      }
    }

    if (canUseDocHubBackend && projectData.id) {
      const opened = await openDocHubBackendLink({
        projectId: projectData.id,
        kind: "tender",
        categoryId: activeCategory.id,
        categoryTitle: activeCategory.title,
      });
      if (opened) return;
    }

    const onlineTenderPath = getDesktopTenderFolderPath(
      "",
      activeCategory.title,
      projectDetails.docHubStructureV1,
    );
    if (openMappedSharePointFolder(onlineTenderPath)) return;

    if (!isLocalProvider && docHubRoot && !isProbablyUrl(docHubRoot)) {
      const links = getDocHubTenderLinks(
        docHubRoot,
        activeCategory.title,
        docHubStructure,
      );
      if (await openDocHubPath(links.tenderBase)) return;
    }

    if (localFallbackPath) {
      await copyDocHubPath(localFallbackPath);
      return;
    }

    showUnavailableFolder();
  };

  return {
    handleOpenSupplierDocHub,
    handleOpenTenderDocHub,
  };
};
