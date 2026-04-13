import { ipcMain, BrowserWindow } from "electron";
import { SecureStorageService } from "../../services/secureStorage";
import { getBiometricAuthService } from "../../services/biometricAuth";

interface SessionHandlerDependencies {
  storageService: SecureStorageService;
  requireAuth: (sender: Electron.WebContents, channel?: string) => void;
}

const SESSION_CREDENTIALS_KEY = "session_credentials";
const BIOMETRIC_ENABLED_KEY = "biometric_enabled";

export const registerSessionHandlers = ({
  storageService,
  requireAuth,
}: SessionHandlerDependencies): void => {
  // Auth required: writing credentials
  ipcMain.handle(
    "session:saveCredentials",
    async (event, credentials: { refreshToken: string; email: string }): Promise<void> => {
      requireAuth(event.sender, 'session:saveCredentials');
      await storageService.set(SESSION_CREDENTIALS_KEY, JSON.stringify(credentials));
    },
  );

  // Pre-auth: returns credentials ONLY if biometric is NOT enabled.
  // When biometric is enabled, renderer MUST use session:getCredentialsWithBiometric instead.
  // This prevents bypassing biometric verification to access stored tokens.
  ipcMain.handle("session:getCredentials", async (): Promise<{ refreshToken: string; email: string } | null> => {
    const biometricEnabled = await storageService.get(BIOMETRIC_ENABLED_KEY);
    if (biometricEnabled === "true") {
      // Biometric is enabled — refuse to return credentials without biometric verification.
      // Renderer must use session:getCredentialsWithBiometric instead.
      console.log("[SessionHandlers] getCredentials denied: biometric is enabled, use getCredentialsWithBiometric");
      return null;
    }

    const data = await storageService.get(SESSION_CREDENTIALS_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  });

  // Pre-auth: Atomic biometric verification + credential retrieval in the main process.
  // The biometric check happens server-side (main process), not in the renderer,
  // so a compromised renderer cannot skip the biometric prompt.
  ipcMain.handle(
    "session:getCredentialsWithBiometric",
    async (event, reason: string): Promise<{ refreshToken: string; email: string } | null> => {
      const biometricEnabled = await storageService.get(BIOMETRIC_ENABLED_KEY);
      if (biometricEnabled !== "true") {
        // Biometric not enabled, just return credentials normally
        const data = await storageService.get(SESSION_CREDENTIALS_KEY);
        if (!data) return null;
        try { return JSON.parse(data); } catch { return null; }
      }

      const data = await storageService.get(SESSION_CREDENTIALS_KEY);
      if (!data) return null;

      // Perform biometric verification in the main process
      const biometricService = getBiometricAuthService();
      const win = BrowserWindow.fromWebContents(event.sender);
      const windowHandle = win?.getNativeWindowHandle();
      const success = await biometricService.prompt(
        typeof reason === 'string' && reason.length > 0 ? reason : "Odemknout Tender Flow",
        windowHandle,
      );

      if (!success) {
        console.log("[SessionHandlers] Biometric verification failed/cancelled");
        return null;
      }

      console.log("[SessionHandlers] Biometric verification succeeded, returning credentials");
      try { return JSON.parse(data); } catch { return null; }
    },
  );

  // Auth required: clearing credentials
  ipcMain.handle("session:clearCredentials", async (event): Promise<void> => {
    requireAuth(event.sender, 'session:clearCredentials');
    await storageService.delete(SESSION_CREDENTIALS_KEY);
  });

  // Auth required: changing biometric settings
  ipcMain.handle("session:setBiometricEnabled", async (event, enabled: boolean): Promise<void> => {
    requireAuth(event.sender, 'session:setBiometricEnabled');
    await storageService.set(BIOMETRIC_ENABLED_KEY, enabled ? "true" : "false");
  });

  // Pre-auth: needed for login screen biometric UI
  ipcMain.handle("session:isBiometricEnabled", async (): Promise<boolean> => {
    const value = await storageService.get(BIOMETRIC_ENABLED_KEY);
    return value === "true";
  });
};
