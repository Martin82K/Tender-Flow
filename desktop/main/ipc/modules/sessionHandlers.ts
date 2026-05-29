import { ipcMain, BrowserWindow } from "electron";
import { pbkdf2, randomBytes, timingSafeEqual } from "crypto";
import { SecureStorageService } from "../../services/secureStorage";
import { getBiometricAuthService } from "../../services/biometricAuth";

interface SessionHandlerDependencies {
  storageService: SecureStorageService;
  requireAuth: (sender: Electron.WebContents, channel?: string) => void;
}

const SESSION_CREDENTIALS_KEY = "session_credentials";
const BIOMETRIC_ENABLED_KEY = "biometric_enabled";
const PIN_HASH_KEY = "session_pin_hash";
const PIN_ENABLED_KEY = "session_pin_enabled";
const PIN_PBKDF2_ITERATIONS = 310000;
const PIN_MIN_LENGTH = 6;
const PIN_MAX_LENGTH = 12;
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MS = 5 * 60 * 1000;

let failedPinAttempts = 0;
let pinLockedUntil = 0;

interface StoredPinHash {
  version: 1;
  algorithm: "pbkdf2-sha256";
  iterations: number;
  salt: string;
  hash: string;
}

const normalizePin = (pin: unknown): string => {
  if (typeof pin !== "string") return "";
  return pin.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH);
};

const validatePin = (pin: string): void => {
  if (!/^\d+$/.test(pin) || pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
    throw new Error("PIN_POLICY_VIOLATION");
  }
};

const derivePinHash = async (
  pin: string,
  salt: Buffer,
  iterations: number,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    pbkdf2(pin, salt, iterations, 32, "sha256", (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });

const createStoredPinHash = async (pin: string): Promise<StoredPinHash> => {
  validatePin(pin);
  const salt = randomBytes(16);
  const hash = await derivePinHash(pin, salt, PIN_PBKDF2_ITERATIONS);
  return {
    version: 1,
    algorithm: "pbkdf2-sha256",
    iterations: PIN_PBKDF2_ITERATIONS,
    salt: salt.toString("base64"),
    hash: hash.toString("base64"),
  };
};

const readStoredPinHash = async (
  storageService: SecureStorageService,
): Promise<StoredPinHash | null> => {
  const raw = await storageService.get(PIN_HASH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPinHash>;
    if (
      parsed.version !== 1 ||
      parsed.algorithm !== "pbkdf2-sha256" ||
      typeof parsed.iterations !== "number" ||
      typeof parsed.salt !== "string" ||
      typeof parsed.hash !== "string"
    ) {
      return null;
    }
    return parsed as StoredPinHash;
  } catch {
    return null;
  }
};

const verifyStoredPin = async (
  storageService: SecureStorageService,
  rawPin: unknown,
): Promise<boolean> => {
  const now = Date.now();
  if (pinLockedUntil > now) return false;

  const pin = normalizePin(rawPin);
  const stored = await readStoredPinHash(storageService);
  if (!stored) return false;

  let matches = false;
  try {
    validatePin(pin);
    const expected = Buffer.from(stored.hash, "base64");
    const actual = await derivePinHash(pin, Buffer.from(stored.salt, "base64"), stored.iterations);
    matches = expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    matches = false;
  }

  if (matches) {
    failedPinAttempts = 0;
    pinLockedUntil = 0;
    return true;
  }

  failedPinAttempts += 1;
  if (failedPinAttempts >= PIN_MAX_ATTEMPTS) {
    pinLockedUntil = now + PIN_LOCK_MS;
    failedPinAttempts = 0;
  }
  return false;
};

const readSessionCredentials = async (
  storageService: SecureStorageService,
): Promise<{ refreshToken: string; email: string } | null> => {
  const data = await storageService.get(SESSION_CREDENTIALS_KEY);
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as { refreshToken?: unknown; email?: unknown };
    if (typeof parsed.refreshToken !== "string" || typeof parsed.email !== "string") {
      return null;
    }
    return { refreshToken: parsed.refreshToken, email: parsed.email };
  } catch {
    return null;
  }
};

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
    const pinEnabled = await storageService.get(PIN_ENABLED_KEY);
    if (biometricEnabled === "true" || pinEnabled === "true") {
      // Local unlock is enabled — refuse to return credentials without a local factor.
      // Renderer must use session:getCredentialsWithBiometric or session:getCredentialsWithPin instead.
      console.log("[SessionHandlers] getCredentials denied: local unlock is enabled");
      return null;
    }

    return readSessionCredentials(storageService);
  });

  // Pre-auth: Atomic biometric verification + credential retrieval in the main process.
  // The biometric check happens server-side (main process), not in the renderer,
  // so a compromised renderer cannot skip the biometric prompt.
  ipcMain.handle(
    "session:getCredentialsWithBiometric",
    async (event, reason: string): Promise<{ refreshToken: string; email: string } | null> => {
      const biometricEnabled = await storageService.get(BIOMETRIC_ENABLED_KEY);
      const pinEnabled = await storageService.get(PIN_ENABLED_KEY);
      if (biometricEnabled !== "true") {
        if (pinEnabled === "true") return null;
        // No local unlock is enabled, just return credentials normally.
        return readSessionCredentials(storageService);
      }

      const credentials = await readSessionCredentials(storageService);
      if (!credentials) return null;

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
      return credentials;
    },
  );

  // Pre-auth: Atomic PIN verification + credential retrieval in the main process.
  // The renderer never receives the PIN hash or credentials before verification.
  ipcMain.handle(
    "session:getCredentialsWithPin",
    async (_event, pin: string): Promise<{ refreshToken: string; email: string } | null> => {
      const pinEnabled = await storageService.get(PIN_ENABLED_KEY);
      if (pinEnabled !== "true") return null;

      const credentials = await readSessionCredentials(storageService);
      if (!credentials) return null;

      const success = await verifyStoredPin(storageService, pin);
      if (!success) {
        console.log("[SessionHandlers] PIN verification failed/cancelled");
        return null;
      }

      console.log("[SessionHandlers] PIN verification succeeded, returning credentials");
      return credentials;
    },
  );

  // Pre-auth: needed for startup cleanup of corrupted sessions.
  // Risk: attacker could clear credentials (self-destructive, not a data leak).
  ipcMain.handle("session:clearCredentials", async (): Promise<void> => {
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

  // Auth required: changing PIN settings
  ipcMain.handle("session:setPin", async (event, pin: string): Promise<void> => {
    requireAuth(event.sender, "session:setPin");
    const normalizedPin = normalizePin(pin);
    const storedHash = await createStoredPinHash(normalizedPin);
    await storageService.set(PIN_HASH_KEY, JSON.stringify(storedHash));
    await storageService.set(PIN_ENABLED_KEY, "true");
    failedPinAttempts = 0;
    pinLockedUntil = 0;
  });

  ipcMain.handle("session:clearPin", async (event): Promise<void> => {
    requireAuth(event.sender, "session:clearPin");
    await storageService.delete(PIN_HASH_KEY);
    await storageService.set(PIN_ENABLED_KEY, "false");
    failedPinAttempts = 0;
    pinLockedUntil = 0;
  });

  // Pre-auth: needed for login screen PIN UI
  ipcMain.handle("session:isPinEnabled", async (): Promise<boolean> => {
    const value = await storageService.get(PIN_ENABLED_KEY);
    return value === "true" && Boolean(await readStoredPinHash(storageService));
  });
};
