import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveDocHubStructureV1 } from "@/shared/dochub/docHub";
import type { Bid, DemandCategory, ProjectDetails } from "@/types";
import { expectConsoleWarn } from "./utils/consoleGuard";

const mocks = vi.hoisted(() => ({
  folderExists: vi.fn(),
  openInExplorer: vi.fn(),
  openExternal: vi.fn(),
  invokeAuthedFunction: vi.fn(),
}));

vi.mock("@infra/files/fileSystemService", () => ({
  folderExists: mocks.folderExists,
  openInExplorer: mocks.openInExplorer,
}));

vi.mock("@infra/functions/functionsClient", () => ({
  invokeAuthedFunction: mocks.invokeAuthedFunction,
}));

vi.mock("@infra/diagnostics/incidentLogger", () => ({
  logIncident: vi.fn(),
}));

vi.mock("@infra/platform/platformAdapter", () => ({
  default: {
    isDesktop: true,
    shell: { openExternal: mocks.openExternal },
  },
}));

import { usePipelineDocHubActions } from "@/features/projects/model/usePipelineDocHubActions";

const category = {
  id: "category-1",
  title: "Betony",
} as DemandCategory;

const bid = {
  id: "bid-1",
  subcontractorId: "supplier-1",
  companyName: "Dodavatel s.r.o.",
} as Bid;

const project = {
  id: "project-1",
  title: "Projekt",
  categories: [category],
  docHubEnabled: true,
  docHubProvider: "onedrive",
  docHubStatus: "connected",
  docHubRootLink: "D:\\Synchronizace\\Projekt",
  docHubRootId: "local:connection-1",
  docHubRootWebUrl: "https://drive.google.com/drive/folders/cloud-root",
  docHubSettings: {
    gdrive: {
      rootLink: "https://drive.google.com/drive/folders/cloud-root",
      rootName: "Projekt",
      rootId: "cloud-root",
      rootWebUrl: "https://drive.google.com/drive/folders/cloud-root",
    },
  },
} as ProjectDetails;

describe("usePipelineDocHubActions lokální → online fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.folderExists.mockResolvedValue(false);
    mocks.openInExplorer.mockResolvedValue({ success: false, error: "ENOENT" });
    mocks.openExternal.mockResolvedValue(undefined);
    mocks.invokeAuthedFunction.mockReset().mockResolvedValue({
      webUrl: "https://drive.google.com/drive/folders/resolved-folder",
    });
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  const renderActions = () => renderHook(() => usePipelineDocHubActions({
    activeCategory: category,
    projectData: project,
    projectDetails: project,
    docHubRoot: project.docHubRootLink || "",
    docHubStructure: resolveDocHubStructureV1(),
    isDocHubEnabled: true,
    showAlert: vi.fn(),
    resolveDesktopTenderFolderPath: vi.fn().mockResolvedValue(null),
  }));

  it("otevře přesný online odkaz VŘ, když lokální složka není dostupná", async () => {
    const { result } = renderActions();

    await act(async () => result.current.handleOpenTenderDocHub());

    expect(mocks.invokeAuthedFunction).toHaveBeenCalledWith("dochub-get-link", {
      body: expect.objectContaining({
        projectId: "project-1",
        kind: "tender",
        categoryId: "category-1",
      }),
    });
    expect(mocks.openExternal).toHaveBeenCalledWith(
      "https://drive.google.com/drive/folders/resolved-folder",
    );
  });

  it("použije online fallback i u staršího projektu bez uloženého stavu", async () => {
    const legacyProject: ProjectDetails = {
      ...project,
      docHubStatus: undefined,
    };
    const { result } = renderHook(() => usePipelineDocHubActions({
      activeCategory: category,
      projectData: legacyProject,
      projectDetails: legacyProject,
      docHubRoot: legacyProject.docHubRootLink || "",
      docHubStructure: resolveDocHubStructureV1(),
      isDocHubEnabled: true,
      showAlert: vi.fn(),
      resolveDesktopTenderFolderPath: vi.fn().mockResolvedValue(null),
    }));

    await act(async () => result.current.handleOpenTenderDocHub());

    expect(mocks.invokeAuthedFunction).toHaveBeenCalledWith(
      "dochub-get-link",
      expect.anything(),
    );
    expect(mocks.openExternal).toHaveBeenCalledWith(
      "https://drive.google.com/drive/folders/resolved-folder",
    );
  });

  it("otevře sdílený OneDrive fallback pouze z uložené SharePoint URL", async () => {
    const sharedLocalProject: ProjectDetails = {
      ...project,
      title: "26034 Pyrum - spodní stavba",
      docHubProvider: "onedrive",
      docHubRootId: "local:owner-connection",
      docHubRootWebUrl: "https://baustavkv-my.sharepoint.com/shared/project-root",
      docHubSettings: {
        onedrive_cloud: {
          rootLink: "https://baustavkv-my.sharepoint.com/shared/project-root",
          rootWebUrl: "https://baustavkv-my.sharepoint.com/shared/project-root",
        },
      },
    };
    mocks.invokeAuthedFunction.mockResolvedValueOnce({
      webUrl: "https://baustavkv-my.sharepoint.com/shared/tender-folder",
    });
    const showAlert = vi.fn();
    const { result } = renderHook(() => usePipelineDocHubActions({
      activeCategory: category,
      projectData: sharedLocalProject,
      projectDetails: sharedLocalProject,
      docHubRoot: sharedLocalProject.docHubRootLink || "",
      docHubStructure: resolveDocHubStructureV1(),
      isDocHubEnabled: true,
      showAlert,
      resolveDesktopTenderFolderPath: vi.fn().mockResolvedValue(null),
    }));

    await act(async () => result.current.handleOpenTenderDocHub());

    expect(mocks.invokeAuthedFunction).toHaveBeenCalledWith("dochub-get-link", {
      body: expect.objectContaining({
        projectId: "project-1",
        kind: "tender",
        categoryId: "category-1",
      }),
    });
    expect(mocks.openExternal).toHaveBeenCalledWith(
      "https://baustavkv-my.sharepoint.com/shared/tender-folder",
    );
    expect(showAlert).not.toHaveBeenCalledWith(expect.objectContaining({
      title: "Složka není dostupná",
    }));
  });

  it("přejde online i když složka existovala, ale její otevření mezitím selhalo", async () => {
    expectConsoleWarn("[DocHub] Open failed, falling back online");
    mocks.folderExists.mockResolvedValue(true);
    const { result } = renderHook(() => usePipelineDocHubActions({
      activeCategory: category,
      projectData: project,
      projectDetails: project,
      docHubRoot: project.docHubRootLink || "",
      docHubStructure: resolveDocHubStructureV1(),
      isDocHubEnabled: true,
      showAlert: vi.fn(),
      resolveDesktopTenderFolderPath: vi.fn().mockResolvedValue(
        "D:\\Synchronizace\\Projekt\\03_Vyberova_rizeni\\Betony",
      ),
    }));

    await act(async () => result.current.handleOpenTenderDocHub());

    expect(mocks.openInExplorer).toHaveBeenCalled();
    expect(mocks.invokeAuthedFunction).toHaveBeenCalledWith(
      "dochub-get-link",
      expect.anything(),
    );
    expect(mocks.openExternal).toHaveBeenCalledWith(
      "https://drive.google.com/drive/folders/resolved-folder",
    );
  });

  it("otevře přesný online odkaz subdodavatele, když lokální složka není dostupná", async () => {
    const { result } = renderActions();

    await act(async () => result.current.handleOpenSupplierDocHub(bid));

    expect(mocks.invokeAuthedFunction).toHaveBeenCalledWith("dochub-get-link", {
      body: expect.objectContaining({
        projectId: "project-1",
        kind: "supplier",
        categoryId: "category-1",
        supplierId: "supplier-1",
      }),
    });
    expect(mocks.openExternal).toHaveBeenCalledWith(
      "https://drive.google.com/drive/folders/resolved-folder",
    );
  });

  it("odvodí online složku VŘ z kanonického SharePoint kořene sdíleného projektu", async () => {
    mocks.invokeAuthedFunction.mockRejectedValueOnce(new Error("Owner connection unavailable"));
    const sharedProject: ProjectDetails = {
      ...project,
      docHubRootWebUrl: "https://tenant.sharepoint.com/personal/user_tenant_cz/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fuser_tenant_cz%2FDocuments%2FPyrum&ga=1",
      docHubSettings: null,
    };
    const { result } = renderHook(() => usePipelineDocHubActions({
      activeCategory: category,
      projectData: sharedProject,
      projectDetails: sharedProject,
      docHubRoot: "",
      docHubStructure: resolveDocHubStructureV1(),
      isDocHubEnabled: true,
      showAlert: vi.fn(),
      resolveDesktopTenderFolderPath: vi.fn().mockResolvedValue(null),
    }));

    await act(async () => result.current.handleOpenTenderDocHub());

    expect(window.open).toHaveBeenCalledWith(
      "https://tenant.sharepoint.com/personal/user_tenant_cz/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fuser_tenant_cz%2FDocuments%2FPyrum%2F03_Vyberova_rizeni%2FBetony",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("odvodí online složku dodavatele z kanonického SharePoint kořene sdíleného projektu", async () => {
    mocks.invokeAuthedFunction.mockRejectedValueOnce(new Error("Owner connection unavailable"));
    const sharedProject: ProjectDetails = {
      ...project,
      docHubRootWebUrl: "https://tenant.sharepoint.com/personal/user_tenant_cz/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fuser_tenant_cz%2FDocuments%2FPyrum&ga=1",
      docHubSettings: null,
    };
    const { result } = renderHook(() => usePipelineDocHubActions({
      activeCategory: category,
      projectData: sharedProject,
      projectDetails: sharedProject,
      docHubRoot: "",
      docHubStructure: resolveDocHubStructureV1(),
      isDocHubEnabled: true,
      showAlert: vi.fn(),
      resolveDesktopTenderFolderPath: vi.fn().mockResolvedValue(null),
    }));

    await act(async () => result.current.handleOpenSupplierDocHub(bid));

    expect(window.open).toHaveBeenCalledWith(
      "https://tenant.sharepoint.com/personal/user_tenant_cz/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fuser_tenant_cz%2FDocuments%2FPyrum%2F03_Vyberova_rizeni%2FBetony%2FPoptavky%2FDodavatel%20s.r.o.",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("vysvětlí vlastníkovi nutnost kanonické adresy u SharePoint sharing odkazu", async () => {
    mocks.invokeAuthedFunction.mockRejectedValueOnce(new Error("Owner connection unavailable"));
    const sharingProject: ProjectDetails = {
      ...project,
      docHubRootWebUrl: "https://tenant.sharepoint.com/:f:/g/personal/user_tenant_cz/opaque-share-token",
      docHubSettings: null,
    };
    const showAlert = vi.fn();
    const { result } = renderHook(() => usePipelineDocHubActions({
      activeCategory: category,
      projectData: sharingProject,
      projectDetails: sharingProject,
      docHubRoot: "",
      docHubStructure: resolveDocHubStructureV1(),
      isDocHubEnabled: true,
      showAlert,
      resolveDesktopTenderFolderPath: vi.fn().mockResolvedValue(null),
    }));

    await act(async () => result.current.handleOpenTenderDocHub());

    expect(window.open).not.toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("finální adresu OneDrive s parametrem id"),
    }));
  });

  it("neotevře nepovolenou URL ani kořen, když selže přesný backend odkaz", async () => {
    mocks.invokeAuthedFunction.mockResolvedValueOnce({
      webUrl: "https://evil.example/phishing",
    });
    const showAlert = vi.fn();
    const { result } = renderHook(() => usePipelineDocHubActions({
      activeCategory: category,
      projectData: project,
      projectDetails: project,
      docHubRoot: project.docHubRootLink || "",
      docHubStructure: resolveDocHubStructureV1(),
      isDocHubEnabled: true,
      showAlert,
      resolveDesktopTenderFolderPath: vi.fn().mockResolvedValue(null),
    }));

    await act(async () => result.current.handleOpenTenderDocHub());

    expect(mocks.openExternal).not.toHaveBeenCalledWith("https://evil.example/phishing");
    expect(mocks.openExternal).not.toHaveBeenCalledWith(
      "https://drive.google.com/drive/folders/cloud-root",
    );
    expect(showAlert).toHaveBeenCalledWith(expect.objectContaining({
      copyableText: expect.stringContaining("03_Vyberova_rizeni"),
    }));
  });

  it("nevytváří syntetickou podadresu z cloudové webové URL po selhání backendu", async () => {
    mocks.invokeAuthedFunction.mockRejectedValueOnce(new Error("Folder link not available"));
    const cloudProject: ProjectDetails = {
      ...project,
      docHubProvider: "gdrive",
      docHubRootLink: "https://drive.google.com/drive/folders/cloud-root",
      docHubRootId: "cloud-root",
    };
    const showAlert = vi.fn();
    const { result } = renderHook(() => usePipelineDocHubActions({
      activeCategory: category,
      projectData: cloudProject,
      projectDetails: cloudProject,
      docHubRoot: cloudProject.docHubRootLink || "",
      docHubStructure: resolveDocHubStructureV1(),
      isDocHubEnabled: true,
      showAlert,
      resolveDesktopTenderFolderPath: vi.fn().mockResolvedValue(null),
    }));

    await act(async () => result.current.handleOpenTenderDocHub());

    expect(mocks.openExternal).not.toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalledWith(expect.objectContaining({
      title: "Složka není dostupná",
      variant: "danger",
    }));
  });

  it("po selhání lokálního i online otevření zkopíruje lokální cestu VŘ", async () => {
    const localOnlyProject: ProjectDetails = {
      ...project,
      docHubRootWebUrl: null,
      docHubSettings: null,
    };
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const showAlert = vi.fn();
    const { result } = renderHook(() => usePipelineDocHubActions({
      activeCategory: category,
      projectData: localOnlyProject,
      projectDetails: localOnlyProject,
      docHubRoot: localOnlyProject.docHubRootLink || "",
      docHubStructure: resolveDocHubStructureV1(),
      isDocHubEnabled: true,
      showAlert,
      resolveDesktopTenderFolderPath: vi.fn().mockResolvedValue(null),
    }));

    await act(async () => result.current.handleOpenTenderDocHub());

    expect(writeText).toHaveBeenCalledWith(
      "D:\\Synchronizace\\Projekt\\03_Vyberova_rizeni\\Betony",
    );
    expect(showAlert).toHaveBeenCalledWith(expect.objectContaining({
      title: "Zkopírováno",
      variant: "success",
    }));
  });

  it("zkopíruje existující cestu i když její otevření selže a online záloha chybí", async () => {
    expectConsoleWarn("[DocHub] Open failed, falling back online");
    const localOnlyProject: ProjectDetails = {
      ...project,
      docHubRootWebUrl: null,
      docHubSettings: null,
    };
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const existingPath = "D:\\Synchronizace\\Projekt\\03_Vyberova_rizeni\\Betony";
    const { result } = renderHook(() => usePipelineDocHubActions({
      activeCategory: category,
      projectData: localOnlyProject,
      projectDetails: localOnlyProject,
      docHubRoot: localOnlyProject.docHubRootLink || "",
      docHubStructure: resolveDocHubStructureV1(),
      isDocHubEnabled: true,
      showAlert: vi.fn(),
      resolveDesktopTenderFolderPath: vi.fn().mockResolvedValue(existingPath),
    }));

    await act(async () => result.current.handleOpenTenderDocHub());

    expect(mocks.openInExplorer).toHaveBeenCalledWith(existingPath);
    expect(writeText).toHaveBeenCalledWith(existingPath);
  });
});
