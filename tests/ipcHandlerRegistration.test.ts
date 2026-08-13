import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  let resolveCleanup: (() => void) | undefined;
  const cleanupPromise = new Promise<void>((resolve) => {
    resolveCleanup = resolve;
  });

  return {
    cleanup: vi.fn(() => cleanupPromise),
    completeCleanup: () => resolveCleanup?.(),
    handle: vi.fn(),
    registerFsHandlers: vi.fn(),
  };
});

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/tmp/tender-flow-test"),
    getVersion: vi.fn(() => "test"),
    isPackaged: false,
    quit: vi.fn(),
  },
  BrowserWindow: {
    fromWebContents: vi.fn(),
  },
  dialog: {
    showMessageBox: vi.fn(),
    showErrorBox: vi.fn(),
  },
  ipcMain: {
    handle: mocks.handle,
  },
  nativeTheme: {
    themeSource: "system",
  },
  shell: {
    openExternal: vi.fn(),
    openPath: vi.fn(),
  },
}));

vi.mock("../desktop/main/services/secureStorage", () => ({
  SecureStorageService: class {},
}));
vi.mock("../desktop/main/services/retiredFeatureStorage", () => ({
  cleanupRetiredDesktopFeatureStorage: mocks.cleanup,
}));
vi.mock("../desktop/main/ipc/modules/fsHandlers", () => ({
  registerFsHandlers: mocks.registerFsHandlers,
}));
vi.mock("../desktop/main/ipc/modules/netHandlers", () => ({ registerNetHandlers: vi.fn() }));
vi.mock("../desktop/main/ipc/modules/oauthHandlers", () => ({ registerOAuthHandlers: vi.fn() }));
vi.mock("../desktop/main/ipc/modules/sessionHandlers", () => ({ registerSessionHandlers: vi.fn() }));
vi.mock("../desktop/main/ipc/modules/watcherHandlers", () => ({ registerWatcherHandlers: vi.fn() }));
vi.mock("../desktop/main/ipc/modules/notificationHandlers", () => ({ registerNotificationHandlers: vi.fn() }));
vi.mock("../desktop/main/ipc/modules/backupHandlers", () => ({ registerBackupHandlers: vi.fn() }));
vi.mock("../desktop/main/ipc/modules/publicAuthHandlers", () => ({ registerPublicAuthHandlers: vi.fn() }));
vi.mock("../desktop/main/services/autoUpdater", () => ({
  getAutoUpdaterService: vi.fn(() => ({
    checkForUpdates: vi.fn(),
    quitAndInstall: vi.fn(),
  })),
}));
vi.mock("../desktop/main/ipc/modules/docxConversion", () => ({ convertToDocx: vi.fn() }));
vi.mock("../desktop/main/services/ipcAuthGuard", () => ({
  ipcAuthGuard: {
    isTrustedSender: vi.fn(),
    requireAuth: vi.fn(),
    setAuthenticatedFromRenderer: vi.fn(),
    setMainWindow: vi.fn(),
  },
}));
vi.mock("../desktop/main/security/externalUrlPolicy", () => ({
  isAllowedExternalUrl: vi.fn(),
  parseExternalUrl: vi.fn(),
}));
vi.mock("../desktop/main/services/publicEnv", () => ({ getSupabasePublicConfig: vi.fn() }));

describe("registrace desktop IPC handlerů", () => {
  it("nezpřístupní storage operace před dokončením úklidu vyřazených klíčů", async () => {
    const { registerIpcHandlers } = await import("../desktop/main/ipc/handlers");

    const registration = registerIpcHandlers();

    expect(mocks.cleanup).toHaveBeenCalledTimes(1);
    expect(mocks.handle).not.toHaveBeenCalled();
    expect(mocks.registerFsHandlers).not.toHaveBeenCalled();

    mocks.completeCleanup();
    await registration;

    expect(mocks.registerFsHandlers).toHaveBeenCalledTimes(1);
    expect(mocks.handle).toHaveBeenCalled();
  });
});
