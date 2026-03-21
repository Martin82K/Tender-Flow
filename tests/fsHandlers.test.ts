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
    fsMock.realpath.mockResolvedValue("/Users/tester/chybi");

    const { registerFsHandlers } = await import("../desktop/main/ipc/modules/fsHandlers");
    registerFsHandlers({
      resolvePortableReadPath: vi.fn(async (value: string) => value),
      resolvePortableWritePath: vi.fn(async (value: string) => value),
    });

    const handler = handlers.get("fs:openInExplorer");
    expect(handler).toBeTypeOf("function");

    const result = await handler?.({}, "/Users/tester/chybi");
    expect(result).toEqual({ success: false, error: "The file does not exist" });
  });

  it("odmitne fs:readFile mimo povolene rooty", async () => {
    fsMock.realpath.mockResolvedValue("/etc/passwd");
    const { registerFsHandlers } = await import("../desktop/main/ipc/modules/fsHandlers");
    registerFsHandlers({
      resolvePortableReadPath: vi.fn(async (value: string) => value),
      resolvePortableWritePath: vi.fn(async (value: string) => value),
    });

    const handler = handlers.get("fs:readFile");
    await expect(handler?.({}, "/etc/passwd")).rejects.toThrow("Access denied");
    expect(fsMock.readFile).not.toHaveBeenCalled();
  });

  it("povoli fs:readFile v tmp rootu", async () => {
    fsMock.realpath.mockResolvedValue("/Users/tester/safe.docx");
    fsMock.readFile.mockResolvedValue(Buffer.from("ok"));
    const { registerFsHandlers } = await import("../desktop/main/ipc/modules/fsHandlers");
    registerFsHandlers({
      resolvePortableReadPath: vi.fn(async (value: string) => value),
      resolvePortableWritePath: vi.fn(async (value: string) => value),
    });

    const handler = handlers.get("fs:readFile");
    const output = await handler?.({}, "/Users/tester/safe.docx");
    expect(output).toEqual(Buffer.from("ok"));
    expect(fsMock.readFile).toHaveBeenCalledWith("/Users/tester/safe.docx");
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
    });

    const handler = handlers.get("fs:writeFile");
    await expect(handler?.({}, "/private/etc/hack.txt", "x")).rejects.toThrow("Access denied");
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });
});
