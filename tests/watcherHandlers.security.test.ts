import { beforeEach, describe, expect, it, vi } from "vitest";

const handlers = new Map<string, (...args: any[]) => Promise<unknown>>();
const folderWatcherStart = vi.hoisted(() => vi.fn());
const fsMock = vi.hoisted(() => ({
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
  BrowserWindow: {
    fromWebContents: vi.fn(() => ({ webContents: { send: vi.fn() } })),
  },
  app: {
    getPath: vi.fn((name: string) => {
      if (name === "userData") return "/Users/tester/Library/Application Support/TenderFlow";
      return "/tmp";
    }),
  },
}));

vi.mock("../desktop/main/services/folderWatcher", () => ({
  FolderWatcherService: vi.fn().mockImplementation(() => ({
    start: folderWatcherStart,
    stop: vi.fn(),
    getSnapshot: vi.fn(),
  })),
}));

describe("watcherHandlers security", () => {
  beforeEach(() => {
    handlers.clear();
    folderWatcherStart.mockReset();
    fsMock.realpath.mockReset();
    fsMock.realpath.mockImplementation(async (targetPath: string) => targetPath);
    vi.resetModules();
  });

  it("odmitne watcher:start mimo realpath allowed rooty", async () => {
    const { registerWatcherHandlers } = await import("../desktop/main/ipc/modules/watcherHandlers");
    registerWatcherHandlers({
      resolvePortableReadPath: vi.fn(async (value: string) => value),
      requireAuth: vi.fn(),
    });

    await expect(handlers.get("watcher:start")?.({ sender: {} }, "/Users/tester/Tender"))
      .rejects.toThrow("Access denied");

    expect(folderWatcherStart).not.toHaveBeenCalled();
  });
});
