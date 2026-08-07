import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  on: vi.fn(),
  quit: vi.fn(),
  requestSingleInstanceLock: vi.fn(() => false),
  whenReady: vi.fn(() => new Promise<void>(() => undefined)),
}));

vi.mock("electron-squirrel-startup", () => ({ default: false }));
vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
}));
vi.mock("fs", () => ({
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
}));
vi.mock("electron", () => ({
  app: {
    commandLine: { appendSwitch: vi.fn() },
    getPath: vi.fn(() => "/tmp/tender-flow-single-instance-test"),
    isPackaged: true,
    on: mocks.on,
    quit: mocks.quit,
    requestSingleInstanceLock: mocks.requestSingleInstanceLock,
    setPath: vi.fn(),
    whenReady: mocks.whenReady,
  },
  BrowserWindow: class {},
  dialog: {},
  ipcMain: {},
  nativeImage: {},
  nativeTheme: {},
  session: {},
  shell: {},
}));
vi.mock("../desktop/main/ipc/handlers", () => ({ registerIpcHandlers: vi.fn() }));
vi.mock("../desktop/main/services/autoUpdater", () => ({ getAutoUpdaterService: vi.fn() }));
vi.mock("../desktop/main/services/mcpServer", () => ({ startMcpServer: vi.fn() }));
vi.mock("../desktop/main/services/csp", () => ({
  buildDesktopCsp: vi.fn(),
  shouldInjectDesktopCsp: vi.fn(),
}));
vi.mock("../desktop/main/services/windowSecurity", () => ({
  buildMainWindowWebPreferences: vi.fn(),
}));
vi.mock("../desktop/main/services/ipcAuthGuard", () => ({ ipcAuthGuard: {} }));
vi.mock("../desktop/main/security/externalUrlPolicy", () => ({ canOpenExternalUrl: vi.fn() }));
vi.mock("../desktop/main/services/publicEnv", () => ({
  getDesktopRendererPublicEnv: vi.fn(() => ({})),
}));

describe("desktop single-instance bootstrap", () => {
  it("ukončí druhý proces před registrací lifecycle handlerů", async () => {
    await import("../desktop/main/main");

    expect(mocks.requestSingleInstanceLock).toHaveBeenCalledTimes(1);
    expect(mocks.quit).toHaveBeenCalledTimes(1);
    expect(mocks.whenReady).not.toHaveBeenCalled();
    expect(mocks.on).not.toHaveBeenCalled();
  });
});
