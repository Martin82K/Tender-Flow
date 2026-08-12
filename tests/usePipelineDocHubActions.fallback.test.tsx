import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveDocHubStructureV1 } from "@/shared/dochub/docHub";
import type { Bid, DemandCategory, ProjectDetails } from "@/types";
import { expectConsoleWarn } from "./utils/consoleGuard";

const mocks = vi.hoisted(() => ({
  folderExists: vi.fn(),
  openInExplorer: vi.fn(),
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
  default: { isDesktop: true },
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
    mocks.invokeAuthedFunction.mockResolvedValue({
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
    expect(window.open).toHaveBeenCalledWith(
      "https://drive.google.com/drive/folders/resolved-folder",
      "_blank",
      "noopener,noreferrer",
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
    expect(window.open).toHaveBeenCalledWith(
      "https://drive.google.com/drive/folders/resolved-folder",
      "_blank",
      "noopener,noreferrer",
    );
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
    expect(window.open).toHaveBeenCalledWith(
      "https://drive.google.com/drive/folders/resolved-folder",
      "_blank",
      "noopener,noreferrer",
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
    expect(window.open).toHaveBeenCalledWith(
      "https://drive.google.com/drive/folders/resolved-folder",
      "_blank",
      "noopener,noreferrer",
    );
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

    expect(window.open).not.toHaveBeenCalledWith(
      "https://evil.example/phishing",
      expect.anything(),
      expect.anything(),
    );
    expect(window.open).not.toHaveBeenCalledWith(
      "https://drive.google.com/drive/folders/cloud-root",
      expect.anything(),
      expect.anything(),
    );
    expect(showAlert).toHaveBeenCalledWith(expect.objectContaining({
      copyableText: expect.stringContaining("03_Vyberova_rizeni"),
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
