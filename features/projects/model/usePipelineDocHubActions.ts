import { invokeAuthedFunction } from "@/services/functionsClient";
import { folderExists } from "@/services/fileSystemService";
import { logIncident } from "@/services/incidentLogger";
import platformAdapter from "@/services/platformAdapter";
import {
  getDocHubTenderLinks,
  getDocHubTenderLinksDesktop,
  isProbablyUrl,
  slugifyDocHubSegmentStrict,
} from "@/utils/docHub";
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
  docHubStructure: ReturnType<typeof import("@/utils/docHub").resolveDocHubStructureV1>;
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
  const canUseDocHubBackend =
    !!projectDetails.docHubProvider &&
    projectDetails.docHubProvider !== "onedrive" &&
    !!projectDetails.docHubRootId &&
    projectDetails.docHubStatus === "connected";

  const openOrCopyDocHubPath = async (path: string) => {
    console.log("[DocHub] openOrCopyDocHubPath called with path:", path);
    if (!path) {
      console.warn("[DocHub] Empty path, returning");
      return;
    }
    if (isProbablyUrl(path)) {
      console.log("[DocHub] Path is URL, opening in browser");
      window.open(path, "_blank", "noopener,noreferrer");
      return;
    }

    console.log(
      "[DocHub] Attempting to open local path. isDocHubEnabled:",
      isDocHubEnabled,
    );
    if (isDocHubEnabled && !isProbablyUrl(path)) {
      try {
        const { fileSystemAdapter, isDesktop } =
          await import("@/services/platformAdapter");
        console.log("[DocHub] isDesktop:", isDesktop);
        if (isDesktop) {
          console.log(
            "[DocHub] Calling fileSystemAdapter.openInExplorer with path:",
            path,
          );
          const result = await fileSystemAdapter.openInExplorer(path);
          if (result.success) {
            console.log("[DocHub] openInExplorer completed successfully");
            return;
          }
          throw new Error(result.error || "Nepodařilo se otevřít cestu v průzkumníku.");
        }

      } catch (error) {
        console.warn("[DocHub] Open failed, falling back to copy", error);
        void logIncident({
          severity: "warn",
          source: "renderer",
          category: "storage",
          code: "DOCHUB_OPEN_PATH_FALLBACK",
          message: `Otevření DocHub cesty selhalo, přecházím na kopírování: ${error instanceof Error ? error.message : String(error)}`,
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

  const openDocHubBackendLink = async (payload: any) => {
    if (
      projectData.docHubProvider === "onedrive"
    ) {
      console.warn(
        "[DocHub] Blocked backend call for Tender Flow Desktop provider",
      );
      return;
    }

    try {
      const data = await invokeAuthedFunction<any>("dochub-get-link", {
        body: payload,
      });
      const webUrl = (data as any)?.webUrl as string | undefined;
      if (!webUrl) throw new Error("Backend nevrátil webUrl");
      window.open(webUrl, "_blank", "noopener,noreferrer");
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
      showAlert({ title: "DocHub chyba", message, variant: "danger" });
    }
  };

  const handleOpenSupplierDocHub = (bid: Bid) => {
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

    const isLocalProvider = projectData.docHubProvider === "onedrive";

    if (canUseDocHubBackend && projectData.id && !isLocalProvider) {
      void openDocHubBackendLink({
        projectId: projectData.id,
        kind: "supplier",
        categoryId: activeCategory.id,
        categoryTitle: activeCategory.title,
        supplierId: bid.subcontractorId,
        supplierName: bid.companyName,
      });
      return;
    }

    const isDesktopMode = platformAdapter.isDesktop;
    console.log("[DocHub] isDesktopMode:", isDesktopMode);

    if (isDesktopMode) {
      const handleDesktopPath = async () => {
        const supplierPath = getDocHubTenderLinksDesktop(
          docHubRoot,
          activeCategory.title,
          bid.companyName,
          projectDetails.docHubStructureV1,
        );

        if (await folderExists(supplierPath)) {
          console.log("[DocHub] Found aligned folder:", supplierPath);
          await openOrCopyDocHubPath(supplierPath);
          return;
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
          await openOrCopyDocHubPath(strictPath);
          return;
        }

        console.log("[DocHub] Folder not found, attempting standard:", supplierPath);
        await openOrCopyDocHubPath(supplierPath);
      };

      void handleDesktopPath();
      return;
    }

    const links = getDocHubTenderLinks(
      docHubRoot,
      activeCategory.title,
      docHubStructure,
    );
    void openOrCopyDocHubPath(links.supplierBase(bid.companyName));
  };

  const handleOpenTenderDocHub = async () => {
    if (!isDocHubEnabled || !activeCategory) return;

    const isDesktopMode = platformAdapter.isDesktop;

    if (canUseDocHubBackend && projectData.id && !isDesktopMode) {
      await openDocHubBackendLink({
        projectId: projectData.id,
        kind: "tender",
        categoryId: activeCategory.id,
        categoryTitle: activeCategory.title,
      });
      return;
    }

    if (isDesktopMode) {
      const tenderPath = await resolveDesktopTenderFolderPath(activeCategory.title);
      if (tenderPath) {
        console.log("[DocHub] Opening tender folder:", tenderPath);
        await openOrCopyDocHubPath(tenderPath);
      }
      return;
    }

    const links = getDocHubTenderLinks(
      docHubRoot,
      activeCategory.title,
      docHubStructure,
    );
    await openOrCopyDocHubPath(links.tenderBase);
  };

  return {
    handleOpenSupplierDocHub,
    handleOpenTenderDocHub,
  };
};
