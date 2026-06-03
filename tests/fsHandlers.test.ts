import { beforeEach, describe, expect, it, vi } from "vitest";

const handlers = new Map<string, (...args: any[]) => Promise<unknown>>();
const fsMock = vi.hoisted(() => ({
  readdir: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
  rename: vi.fn(),
  realpath: vi.fn(),
}));

const normalizePathForAssert = (value: string) => value.replace(/^[A-Z]:/i, "").replace(/\\/g, "/");

vi.mock("fs/promises", () => ({
  default: fsMock,
  ...fsMock,
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => Promise<unknown>) => {
      handlers.set(channel, handler);
    }),
  },
  BrowserWindow: {
    fromWebContents: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  shell: {
    openPath: vi.fn(),
  },
  app: {
    getPath: vi.fn((name: string) => {
      if (name === "home") return "/Users/tester";
      if (name === "userData") return "/Users/tester/Library/Application Support/TenderFlow";
      return "/tmp";
    }),
  },
}));

describe("fsHandlers", () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    fsMock.readdir.mockReset();
    fsMock.stat.mockReset();
    fsMock.readFile.mockReset();
    fsMock.writeFile.mockReset();
    fsMock.mkdir.mockReset();
    fsMock.rm.mockReset();
    fsMock.rename.mockReset();
    fsMock.realpath.mockReset();
    vi.resetModules();
  });

  it("vrati chybu kdyz shell.openPath vrati text chyby", async () => {
    const { shell } = await import("electron");
    vi.mocked(shell.openPath).mockResolvedValue("The file does not exist");
    fsMock.realpath.mockImplementation(async (targetPath: string) => targetPath);

    const { registerFsHandlers } = await import("../desktop/main/ipc/modules/fsHandlers");
    registerFsHandlers({
      resolvePortableReadPath: vi.fn(async (value: string) => value),
      resolvePortableWritePath: vi.fn(async (value: string) => value),
      requireAuth: vi.fn(),
    });

    const handler = handlers.get("fs:openInExplorer");
    expect(handler).toBeTypeOf("function");

    const result = await handler?.({}, "/Users/tester/Library/Application Support/TenderFlow/chybi");
    expect(result).toEqual({ success: false, error: "The file does not exist" });
  });

  it("odmitne fs:readFile mimo povolene rooty", async () => {
    fsMock.realpath.mockImplementation(async (targetPath: string) => targetPath);
    const { registerFsHandlers } = await import("../desktop/main/ipc/modules/fsHandlers");
    registerFsHandlers({
      resolvePortableReadPath: vi.fn(async (value: string) => value),
      resolvePortableWritePath: vi.fn(async (value: string) => value),
      requireAuth: vi.fn(),
    });

    const handler = handlers.get("fs:readFile");
    await expect(handler?.({}, "/etc/passwd")).rejects.toThrow("Access denied");
    expect(fsMock.readFile).not.toHaveBeenCalled();
  });

  it("nepovoli fs:readFile v home bez explicitniho udeleni pristupu", async () => {
    fsMock.realpath.mockImplementation(async (targetPath: string) => targetPath);
    const { registerFsHandlers } = await import("../desktop/main/ipc/modules/fsHandlers");
    registerFsHandlers({
      resolvePortableReadPath: vi.fn(async (value: string) => value),
      resolvePortableWritePath: vi.fn(async (value: string) => value),
      requireAuth: vi.fn(),
    });

    const handler = handlers.get("fs:readFile");
    await expect(handler?.({}, "/Users/tester/safe.docx")).rejects.toThrow("Access denied");
    expect(fsMock.readFile).not.toHaveBeenCalled();
  });

  it("povoli fs:readFile v userData rootu", async () => {
    fsMock.realpath.mockImplementation(async (targetPath: string) => targetPath);
    fsMock.readFile.mockResolvedValue(Buffer.from("ok"));
    const { registerFsHandlers } = await import("../desktop/main/ipc/modules/fsHandlers");
    registerFsHandlers({
      resolvePortableReadPath: vi.fn(async (value: string) => value),
      resolvePortableWritePath: vi.fn(async (value: string) => value),
      requireAuth: vi.fn(),
    });

    const handler = handlers.get("fs:readFile");
    const output = await handler?.({}, "/Users/tester/Library/Application Support/TenderFlow/safe.docx");
    expect(output).toEqual(Buffer.from("ok"));
    expect(normalizePathForAssert(fsMock.readFile.mock.calls[0][0])).toBe(
      "/Users/tester/Library/Application Support/TenderFlow/safe.docx",
    );
  });

  it("odmitne fs:writeFile mimo povolene rooty", async () => {
    fsMock.realpath.mockImplementation(async (targetPath: string) => {
      if (targetPath === "/private/etc") return "/private/etc";
      throw new Error("not found");
    });

    const { registerFsHandlers } = await import("../desktop/main/ipc/modules/fsHandlers");
    registerFsHandlers({
      resolvePortableReadPath: vi.fn(async (value: string) => value),
      resolvePortableWritePath: vi.fn(async (value: string) => value),
      requireAuth: vi.fn(),
    });

    const handler = handlers.get("fs:writeFile");
    await expect(handler?.({}, "/private/etc/hack.txt", "x")).rejects.toThrow("Access denied");
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it("povoli fs:readFile po explicitnim dialog grantu", async () => {
    const { dialog } = await import("electron");
    fsMock.realpath.mockImplementation(async (targetPath: string) => targetPath);
    fsMock.stat.mockImplementation(async () => ({ isDirectory: () => true }));
    fsMock.readFile.mockResolvedValue(Buffer.from("ok"));
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ["/Users/tester/Projects/Tender"],
    } as any);

    const { registerFsHandlers } = await import("../desktop/main/ipc/modules/fsHandlers");
    registerFsHandlers({
      resolvePortableReadPath: vi.fn(async (value: string) => value),
      resolvePortableWritePath: vi.fn(async (value: string) => value),
      requireAuth: vi.fn(),
    });

    await expect(handlers.get("fs:grantAccess")?.({}, "/Users/tester/Projects/Tender")).resolves.toBe(true);

    const output = await handlers.get("fs:readFile")?.({}, "/Users/tester/Projects/Tender/input.xlsx");
    expect(output).toEqual(Buffer.from("ok"));
    expect(normalizePathForAssert(fsMock.readFile.mock.calls[0][0])).toBe("/Users/tester/Projects/Tender/input.xlsx");
  });

  it("ulozi root vybrany pres selectFolder do persistentniho uloziste", async () => {
    const { dialog } = await import("electron");
    const grantedRootsStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };
    fsMock.realpath.mockImplementation(async (targetPath: string) => targetPath);
    fsMock.stat.mockImplementation(async () => ({ isDirectory: () => true }));
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ["/Users/tester/Projects/Tender"],
    } as any);

    const { registerFsHandlers } = await import("../desktop/main/ipc/modules/fsHandlers");
    registerFsHandlers({
      resolvePortableReadPath: vi.fn(async (value: string) => value),
      resolvePortableWritePath: vi.fn(async (value: string) => value),
      requireAuth: vi.fn(),
      grantedRootsStorage,
    });

    await expect(handlers.get("fs:selectFolder")?.({})).resolves.toEqual({
      path: "/Users/tester/Projects/Tender",
      name: "Tender",
    });

    expect(grantedRootsStorage.set).toHaveBeenCalledTimes(1);
    expect(JSON.parse(grantedRootsStorage.set.mock.calls[0][1])).toContain("/Users/tester/Projects/Tender");
  });

  it("obnovi persistentni root a otevre podcestu bez dalsiho dialogu", async () => {
    const { dialog, shell } = await import("electron");
    const grantedRootsStorage = {
      get: vi.fn().mockResolvedValue(JSON.stringify(["/Users/tester/Projects/Tender"])),
      set: vi.fn().mockResolvedValue(undefined),
    };
    fsMock.realpath.mockImplementation(async (targetPath: string) => targetPath);
    fsMock.stat.mockImplementation(async () => ({ isDirectory: () => true }));
    vi.mocked(shell.openPath).mockResolvedValue("");

    const { registerFsHandlers } = await import("../desktop/main/ipc/modules/fsHandlers");
    registerFsHandlers({
      resolvePortableReadPath: vi.fn(async (value: string) => value),
      resolvePortableWritePath: vi.fn(async (value: string) => value),
      requireAuth: vi.fn(),
      grantedRootsStorage,
    });

    await expect(
      handlers.get("fs:openInExplorer")?.({}, "/Users/tester/Projects/Tender/03_Vyberova_rizeni"),
    ).resolves.toEqual({ success: true });

    expect(vi.mocked(shell.openPath)).toHaveBeenCalledWith("/Users/tester/Projects/Tender/03_Vyberova_rizeni");
    expect(vi.mocked(dialog.showOpenDialog)).not.toHaveBeenCalled();
    expect(grantedRootsStorage.set).not.toHaveBeenCalled();
  });

  it("grantAccess potvrzuje uz premapovanou portable cestu", async () => {
    const { dialog } = await import("electron");
    fsMock.realpath.mockImplementation(async (targetPath: string) => targetPath);
    fsMock.stat.mockImplementation(async () => ({ isDirectory: () => true }));
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ["C:\\Users\\tester\\OneDrive - BAU-STAV a.s\\Projekt"],
    } as any);

    const resolvePortableReadPath = vi.fn(async (value: string) => value);
    const resolvePortableWritePath = vi.fn(async () => "C:\\Users\\tester\\OneDrive - BAU-STAV a.s\\Projekt");

    const { registerFsHandlers } = await import("../desktop/main/ipc/modules/fsHandlers");
    registerFsHandlers({
      resolvePortableReadPath,
      resolvePortableWritePath,
      requireAuth: vi.fn(),
    });

    await expect(
      handlers.get("fs:grantAccess")?.({}, "C:\\Users\\old\\OneDrive - BAU-STAV a.s\\Projekt"),
    ).resolves.toBe(true);

    expect(resolvePortableReadPath).not.toHaveBeenCalled();
    expect(resolvePortableWritePath).toHaveBeenCalledWith("C:\\Users\\old\\OneDrive - BAU-STAV a.s\\Projekt");
    expect(vi.mocked(dialog.showOpenDialog).mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        defaultPath: "C:\\Users\\tester\\OneDrive - BAU-STAV a.s\\Projekt",
      }),
    );
  });

  it("grantAccess pro neexistujici cilovou slozku potvrdi existujiciho rodice", async () => {
    const { dialog } = await import("electron");
    const requestedPath =
      "C:\\Users\\tester\\OneDrive - BAU-STAV a.s\\_Stavby\\26019 - SILNICE III2099\\_Tender Flow";
    const parentPath = "C:\\Users\\tester\\OneDrive - BAU-STAV a.s\\_Stavby\\26019 - SILNICE III2099";

    fsMock.stat.mockImplementation(async (targetPath: string) => {
      if (targetPath === parentPath) return { isDirectory: () => true };
      throw new Error("ENOENT");
    });
    fsMock.realpath.mockImplementation(async (targetPath: string) => targetPath);
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: [parentPath],
    } as any);

    const { registerFsHandlers } = await import("../desktop/main/ipc/modules/fsHandlers");
    registerFsHandlers({
      resolvePortableReadPath: vi.fn(async (value: string) => value),
      resolvePortableWritePath: vi.fn(async (value: string) => value),
      requireAuth: vi.fn(),
    });

    await expect(handlers.get("fs:grantAccess")?.({}, requestedPath)).resolves.toBe(true);

    expect(vi.mocked(dialog.showOpenDialog).mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        defaultPath: parentPath,
      }),
    );
  });
});
