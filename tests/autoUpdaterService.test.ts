import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const updaterMocks = vi.hoisted(() => ({
  eventHandlers: new Map<string, (...args: unknown[]) => void>(),
  handle: vi.fn(),
  updater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    forceDevUpdateConfig: false,
    requestHeaders: null as Record<string, string> | null,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  },
}));

vi.mock("electron-updater", () => ({
  autoUpdater: updaterMocks.updater,
}));

vi.mock("electron", () => ({
  app: {
    getVersion: vi.fn(() => "1.9.6"),
    isPackaged: true,
  },
  ipcMain: {
    handle: updaterMocks.handle,
  },
}));

const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
Object.defineProperty(process, "platform", { configurable: true, value: "win32" });

afterAll(() => {
  if (platformDescriptor) {
    Object.defineProperty(process, "platform", platformDescriptor);
  }
});

describe("AutoUpdaterService", () => {
  beforeEach(() => {
    updaterMocks.eventHandlers.clear();
    updaterMocks.handle.mockReset();
    updaterMocks.updater.autoDownload = false;
    updaterMocks.updater.autoInstallOnAppQuit = false;
    updaterMocks.updater.on.mockReset();
    updaterMocks.updater.on.mockImplementation((event, handler) => {
      updaterMocks.eventHandlers.set(event, handler);
      return updaterMocks.updater;
    });
    updaterMocks.updater.quitAndInstall.mockReset();
  });

  it("stahuje aktualizaci automaticky na pozadí", async () => {
    const { AutoUpdaterService } = await import("../desktop/main/services/autoUpdater");

    new AutoUpdaterService(updaterMocks.updater);

    expect(updaterMocks.updater.autoDownload).toBe(true);
    expect(updaterMocks.updater.autoInstallOnAppQuit).toBe(true);
  });

  it("povolí pouze tichý restart po ověřeném stažení aktualizace", async () => {
    const { AutoUpdaterService } = await import("../desktop/main/services/autoUpdater");
    const service = new AutoUpdaterService(updaterMocks.updater);

    service.quitAndInstall();
    expect(updaterMocks.updater.quitAndInstall).not.toHaveBeenCalled();

    updaterMocks.eventHandlers.get("update-downloaded")?.({ version: "1.9.7" });
    service.quitAndInstall();

    expect(updaterMocks.updater.quitAndInstall).toHaveBeenCalledWith(true, true);
  });
});
