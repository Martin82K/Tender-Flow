import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocHubHierarchyItem } from "@/shared/dochub/docHub";

const mockState = vi.hoisted(() => ({
  logIncident: vi.fn().mockResolvedValue({ incidentId: "INC-1" }),
  selectFolder: vi.fn(),
  listFiles: vi.fn(),
  folderExists: vi.fn(),
  logRuntimeEvent: vi.fn(),
  copyFile: vi.fn(),
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

vi.mock("@infra/diagnostics/runtimeDiagnostics", () => ({
  logRuntimeEvent: mockState.logRuntimeEvent,
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
    copyFile: mockState.copyFile,
    createFolder: mockState.createFolder,
    deleteFolder: mockState.deleteFolder,
    renameFolder: mockState.renameFolder,
    openInExplorer: mockState.openInExplorer,
    openFile: mockState.openFile,
    grantAccess: mockState.grantAccess,
    folderExists: mockState.folderExists,
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
    mockState.folderExists.mockReset().mockResolvedValue(false);
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

  it("preda bezpecne kopirovani platform adapteru", async () => {
    mockState.copyFile.mockResolvedValue({
      success: true,
      path: "/tmp/Betony/rozpocet.xlsx",
      name: "rozpocet.xlsx",
      size: 1234,
    });

    const { copyFile } = await import("../services/fileSystemService");
    await expect(copyFile("/tmp/rozpocet.xlsx", "/tmp/Betony")).resolves.toEqual({
      success: true,
      path: "/tmp/Betony/rozpocet.xlsx",
      name: "rozpocet.xlsx",
      size: 1234,
    });
    expect(mockState.copyFile).toHaveBeenCalledWith(
      "/tmp/rozpocet.xlsx",
      "/tmp/Betony",
    );
  });

  it("neloguje bezne nenalezeni slozky pri folderExists", async () => {
    mockState.folderExists.mockResolvedValue(false);

    const { folderExists } = await import("../services/fileSystemService");
    const result = await folderExists("/tmp/chybi");

    expect(result).toBe(false);
    expect(mockState.logIncident).not.toHaveBeenCalled();
  });

  it("ověří i velkou složku bez načítání souborů a podsložek", async () => {
    mockState.folderExists.mockResolvedValue(true);
    mockState.listFiles.mockRejectedValue(new Error("EACCES: unreadable child in a large tree"));
    const { folderExists } = await import("../services/fileSystemService");

    await expect(folderExists("/private/project/large-folder")).resolves.toBe(true);
    expect(mockState.folderExists).toHaveBeenCalledExactlyOnceWith("/private/project/large-folder");
    expect(mockState.listFiles).not.toHaveBeenCalled();
    expect(mockState.logIncident).not.toHaveBeenCalled();
    expect(mockState.logRuntimeEvent).toHaveBeenCalledWith("filesystem", "operation_timing", {
      stage: "folder_exists", duration_ms: expect.any(Number), outcome: "success",
    });
  });

  it("při odmítnutí IPC nezkouší obejít oprávnění procházením obsahu", async () => {
    mockState.folderExists.mockRejectedValue(new Error("IPC_AUTH_DENIED"));
    const { folderExists } = await import("../services/fileSystemService");
    await expect(folderExists("/private/project")).resolves.toBe(false);
    expect(mockState.listFiles).not.toHaveBeenCalled();
    expect(mockState.grantAccess).not.toHaveBeenCalled();
    expect(mockState.logIncident).toHaveBeenCalledWith(expect.objectContaining({ code: "FS_FOLDER_EXISTS_FAILED" }));
  });

  it("měří autentizaci a otevření odděleně a zachová jejich pořadí", async () => {
    mockState.openInExplorer.mockResolvedValue({ success: true });
    const { openInExplorer } = await import("../services/fileSystemService");
    await expect(openInExplorer("/private/customer-secret")).resolves.toEqual({ success: true });
    const events = mockState.logRuntimeEvent.mock.calls.map(call => call[2]);
    expect(events).toEqual([
      { stage: "authenticate", duration_ms: expect.any(Number), outcome: "success" },
      { stage: "open_in_explorer", duration_ms: expect.any(Number), outcome: "success" },
    ]);
    expect(JSON.stringify(events)).not.toContain("customer-secret");
    expect(JSON.stringify(events)).not.toContain("token-123");
    const authenticate = vi.mocked(window.electronAPI!.auth.setAuthenticated);
    expect(authenticate.mock.invocationCallOrder[0]).toBeLessThan(mockState.openInExplorer.mock.invocationCallOrder[0]);
  });

  it("při neúspěšné autentizaci neotevře složku ani nevyžádá přístup", async () => {
    vi.mocked(window.electronAPI!.auth.setAuthenticated).mockRejectedValue(new Error("IPC_AUTH_DENIED"));
    const { openInExplorer } = await import("../services/fileSystemService");
    await expect(openInExplorer("/private/project")).resolves.toEqual({ success: false, error: "IPC_AUTH_DENIED" });
    expect(mockState.openInExplorer).not.toHaveBeenCalled();
    expect(mockState.grantAccess).not.toHaveBeenCalled();
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

  it("pri vypnutem mezilehlem uzlu vytvori povolene potomky pod nejblizsim povolenym rodicem", async () => {
    mockState.createFolder.mockResolvedValue({ success: true });

    const hierarchy: DocHubHierarchyItem[] = [
      {
        id: "tenders",
        key: "tenders",
        name: "03_Vyberova_rizeni",
        depth: 0,
        enabled: true,
        children: [
          {
            id: "category",
            key: "category",
            name: "{Název VŘ}",
            depth: 1,
            enabled: true,
            children: [
              {
                id: "inquiries",
                key: "tendersInquiries",
                name: "Poptavky",
                depth: 2,
                enabled: false,
                children: [
                  {
                    id: "supplier",
                    key: "supplier",
                    name: "{Název dodavatele}",
                    depth: 3,
                    enabled: true,
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const { ensureStructure } = await import("../services/fileSystemService");
    const result = await ensureStructure({
      rootPath: "C:\\DocHub\\000_TF",
      projectId: "project-1",
      categories: [{ id: "cat-1", title: "Konstrukce suche vystavby" }],
      suppliers: {
        "cat-1": [{ id: "sup-1", name: "Dodavatel s.r.o." }],
      },
      hierarchy,
    });

    expect(result.success).toBe(true);
    expect(result.logs).toContain(
      "⊘ Přeskočeno (vypnuto uživatelem): Poptavky",
    );
    expect(mockState.createFolder).not.toHaveBeenCalledWith(
      "C:\\DocHub\\000_TF\\03_Vyberova_rizeni\\Konstrukce suche vystavby\\Poptavky",
    );
    expect(mockState.createFolder).toHaveBeenCalledWith(
      "C:\\DocHub\\000_TF\\03_Vyberova_rizeni\\Konstrukce suche vystavby\\Dodavatel s.r.o",
    );
  });

  it("pri vypnutem kontextovem uzlu nevytvori potomky do nebezpecne sdilene cesty", async () => {
    mockState.createFolder.mockResolvedValue({ success: true });

    const hierarchy: DocHubHierarchyItem[] = [
      {
        id: "category",
        key: "category",
        name: "{Název VŘ}",
        depth: 0,
        enabled: false,
        children: [
          {
            id: "supplier",
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
      categories: [{ id: "cat-1", title: "Betony" }],
      suppliers: {
        "cat-1": [{ id: "sup-1", name: "Dodavatel s.r.o." }],
      },
      hierarchy,
    });

    expect(result.success).toBe(true);
    expect(mockState.createFolder).toHaveBeenCalledTimes(1);
    expect(mockState.createFolder).toHaveBeenCalledWith("C:\\DocHub\\000_TF");
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
