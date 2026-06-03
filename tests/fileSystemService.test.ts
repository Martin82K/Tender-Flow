import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocHubHierarchyItem } from "@/shared/dochub/docHub";

const mockState = vi.hoisted(() => ({
  logIncident: vi.fn().mockResolvedValue({ incidentId: "INC-1" }),
  selectFolder: vi.fn(),
  listFiles: vi.fn(),
  createFolder: vi.fn(),
  deleteFolder: vi.fn(),
  renameFolder: vi.fn(),
  openInExplorer: vi.fn(),
  openFile: vi.fn(),
  grantAccess: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("../services/incidentLogger", () => ({
  logIncident: mockState.logIncident,
}));

vi.mock("../services/functionsClient", () => ({
  invokeAuthedFunction: vi.fn(),
}));

vi.mock("../services/supabase", () => ({
  supabase: {
    auth: {
      getSession: mockState.getSession,
    },
  },
}));

vi.mock("../services/platformAdapter", () => ({
  isDesktop: true,
  fileSystemAdapter: {
    selectFolder: mockState.selectFolder,
    listFiles: mockState.listFiles,
    createFolder: mockState.createFolder,
    deleteFolder: mockState.deleteFolder,
    renameFolder: mockState.renameFolder,
    openInExplorer: mockState.openInExplorer,
    openFile: mockState.openFile,
    grantAccess: mockState.grantAccess,
    folderExists: vi.fn(),
  },
  watcherAdapter: {
    start: vi.fn(),
    stop: vi.fn(),
    onFileChange: vi.fn(),
  },
}));

describe("fileSystemService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.openFile.mockResolvedValue({ success: false, error: "fail" });
    mockState.grantAccess.mockResolvedValue(false);
    mockState.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "token-123",
          expires_at: 1_900_000_000,
        },
      },
    });
    if (typeof window !== "undefined") {
      (window as any).electronAPI = {
        auth: {
          setAuthenticated: vi.fn().mockResolvedValue(undefined),
        },
      };
    }
  });

  it("loguje chybu při selhání vytvoření složky", async () => {
    mockState.createFolder.mockResolvedValue({ success: false, error: "Pristup odepren" });

    const { createFolder } = await import("../services/fileSystemService");
    const result = await createFolder("/tmp/nova-slozka", { provider: "onedrive", projectId: "project-1" });

    expect(result).toEqual({ success: false, path: undefined, error: "Pristup odepren" });
    expect(mockState.logIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "FS_CREATE_FOLDER_FAILED",
        context: expect.objectContaining({
          action: "create_folder",
          project_id: "project-1",
          target_path: "/tmp/nova-slozka",
        }),
      }),
    );
  });

  it("neloguje storno dialogu pri vyberu slozky", async () => {
    mockState.selectFolder.mockResolvedValue(null);

    const { pickFolder } = await import("../services/fileSystemService");
    const result = await pickFolder();

    expect(result).toEqual({ cancelled: true });
    expect(mockState.logIncident).not.toHaveBeenCalled();
  });

  it("neloguje bezne nenalezeni slozky pri folderExists", async () => {
    mockState.listFiles.mockRejectedValue(new Error("ENOENT: no such file or directory"));

    const { folderExists } = await import("../services/fileSystemService");
    const result = await folderExists("/tmp/chybi");

    expect(result).toBe(false);
    expect(mockState.logIncident).not.toHaveBeenCalled();
  });

  it("loguje chybu pri selhani otevreni slozky", async () => {
    mockState.openInExplorer.mockResolvedValue({ success: false, error: "Application not found" });

    const { openInExplorer } = await import("../services/fileSystemService");
    const result = await openInExplorer("/tmp/slozka");

    expect(result).toEqual({ success: false, error: "Application not found" });
    expect(mockState.logIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "FS_OPEN_IN_EXPLORER_FAILED",
        context: expect.objectContaining({
          action: "open_in_explorer",
          folder_path: "/tmp/slozka",
        }),
      }),
    );
  });

  it("pri selhani otevreni pozada o pristup a otevreni zopakuje", async () => {
    mockState.openInExplorer
      .mockResolvedValueOnce({ success: false, error: "Access denied" })
      .mockResolvedValueOnce({ success: true });
    mockState.grantAccess.mockResolvedValue(true);

    const { openInExplorer } = await import("../services/fileSystemService");
    const result = await openInExplorer("C:\\Users\\old\\OneDrive - BAU-STAV a.s\\Projekt");

    expect(result).toEqual({ success: true });
    expect(mockState.grantAccess).toHaveBeenCalledWith("C:\\Users\\old\\OneDrive - BAU-STAV a.s\\Projekt");
    expect(mockState.openInExplorer).toHaveBeenCalledTimes(2);
  });

  it("pri ensureStructure bezpecne sanitizuje nazvy slozek nekompatibilni s Windows", async () => {
    mockState.createFolder.mockResolvedValue({ success: true });
    mockState.listFiles.mockResolvedValue([]);

    const hierarchy: DocHubHierarchyItem[] = [
      {
        id: "category-1",
        key: "category",
        name: "{Název VŘ}",
        depth: 0,
        enabled: true,
        children: [
          {
            id: "supplier-1",
            key: "supplier",
            name: "{Název dodavatele}",
            depth: 1,
            enabled: true,
            children: [],
          },
        ],
      },
    ];

    const { ensureStructure } = await import("../services/fileSystemService");
    const result = await ensureStructure({
      rootPath: "C:\\DocHub\\000_TF",
      projectId: "project-1",
      categories: [{ id: "cat-1", title: "Zakladni cast" }],
      suppliers: {
        "cat-1": [{ id: "sup-1", name: "IZOMAT stavebniny s.r.o." }],
      },
      hierarchy,
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.logs).toContain(
      '! Upozornění: Nazev slozky "IZOMAT stavebniny s.r.o." byl pro filesystem upraven na "IZOMAT stavebniny s.r.o".',
    );
    expect(mockState.createFolder).toHaveBeenCalledWith("C:\\DocHub\\000_TF");
    expect(mockState.createFolder).toHaveBeenCalledWith("C:\\DocHub\\000_TF\\Zakladni cast");
    expect(mockState.createFolder).toHaveBeenCalledWith("C:\\DocHub\\000_TF\\Zakladni cast\\IZOMAT stavebniny s.r.o");
    expect(mockState.logIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "FS_ENSURE_STRUCTURE_SUCCESS",
        context: expect.objectContaining({
          action: "ensure_structure",
          project_id: "project-1",
        }),
      }),
    );
  });

  it("pri ensureStructure po Access denied pozada o pristup a vytvoreni zopakuje", async () => {
    mockState.createFolder
      .mockResolvedValueOnce({
        success: false,
        error: "Access denied: path is outside allowed roots (C:\\DocHub\\Projekt\\_Tender Flow)",
      })
      .mockResolvedValueOnce({ success: true });
    mockState.grantAccess.mockResolvedValue(true);

    const { ensureStructure } = await import("../services/fileSystemService");
    const result = await ensureStructure({
      rootPath: "C:\\DocHub\\Projekt\\_Tender Flow",
      projectId: "project-1",
      hierarchy: [],
    });

    expect(result.success).toBe(true);
    expect(result.logs).toContain("! Pro vytvoření složky je potřeba potvrdit přístup: C:\\DocHub\\Projekt\\_Tender Flow");
    expect(mockState.grantAccess).toHaveBeenCalledWith("C:\\DocHub\\Projekt\\_Tender Flow");
    expect(mockState.createFolder).toHaveBeenCalledTimes(2);
  });
});
