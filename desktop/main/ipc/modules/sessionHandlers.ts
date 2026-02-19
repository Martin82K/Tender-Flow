import { ipcMain } from "electron";
import { SecureStorageService } from "../../services/secureStorage";

interface SessionHandlerDependencies {
  storageService: SecureStorageService;
}

const SESSION_CREDENTIALS_KEY = "session_credentials";
const BIOMETRIC_ENABLED_KEY = "biometric_enabled";

export const registerSessionHandlers = ({
  storageService,
}: SessionHandlerDependencies): void => {
  ipcMain.handle(
    "session:saveCredentials",
    async (_, credentials: { refreshToken: string; email: string }): Promise<void> => {
      await storageService.set(SESSION_CREDENTIALS_KEY, JSON.stringify(credentials));
    },
  );

  ipcMain.handle("session:getCredentials", async (): Promise<{ refreshToken: string; email: string } | null> => {
    const data = await storageService.get(SESSION_CREDENTIALS_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  });

  ipcMain.handle("session:clearCredentials", async (): Promise<void> => {
    await storageService.delete(SESSION_CREDENTIALS_KEY);
  });

  ipcMain.handle("session:setBiometricEnabled", async (_, enabled: boolean): Promise<void> => {
    await storageService.set(BIOMETRIC_ENABLED_KEY, enabled ? "true" : "false");
  });

  ipcMain.handle("session:isBiometricEnabled", async (): Promise<boolean> => {
    const value = await storageService.get(BIOMETRIC_ENABLED_KEY);
    return value === "true";
  });
};
