import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  userDataPath: "",
  asyncEncryptionAvailable: true,
  syncEncryptionAvailable: true,
  storageBackend: "gnome_libsecret",
  asyncEncryptError: null as Error | null,
}));

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => electronMock.userDataPath),
  },
  safeStorage: {
    decryptStringAsync: vi.fn(async (value: Buffer) => ({
      result: value.toString("utf8"),
      shouldReEncrypt: false,
    })),
    decryptString: vi.fn((value: Buffer) => value.toString("utf8")),
    encryptStringAsync: vi.fn(async (value: string) => {
      if (electronMock.asyncEncryptError) throw electronMock.asyncEncryptError;
      return Buffer.from(value, "utf8");
    }),
    getSelectedStorageBackend: vi.fn(() => electronMock.storageBackend),
    encryptString: vi.fn((value: string) => Buffer.from(value, "utf8")),
    isAsyncEncryptionAvailable: vi.fn(async () => electronMock.asyncEncryptionAvailable),
    isEncryptionAvailable: vi.fn(() => electronMock.syncEncryptionAvailable),
  },
}));

describe("SecureStorageService", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    electronMock.userDataPath = await mkdtemp(join(tmpdir(), "tender-flow-secure-storage-"));
    electronMock.asyncEncryptionAvailable = true;
    electronMock.syncEncryptionAvailable = true;
    electronMock.storageBackend = "gnome_libsecret";
    electronMock.asyncEncryptError = null;
  });

  afterEach(async () => {
    await rm(electronMock.userDataPath, { recursive: true, force: true });
  });

  it("nepřepíše poškozený storage soubor při mazání legacy klíče", async () => {
    const storagePath = join(electronMock.userDataPath, "secure-storage.json");
    const corruptedContent = '{"session":"encrypted"';
    await writeFile(storagePath, corruptedContent, "utf8");
    const { SecureStorageService } = await import("../desktop/main/services/secureStorage");
    const storage = new SecureStorageService();

    await expect(storage.delete("retired-key")).rejects.toThrow();

    await expect(readFile(storagePath, "utf8")).resolves.toBe(corruptedContent);
  });

  it("nezapisuje storage, když mazaný klíč neexistuje", async () => {
    const storagePath = join(electronMock.userDataPath, "secure-storage.json");
    const originalContent = '{"session":"encrypted-session"}';
    await writeFile(storagePath, originalContent, "utf8");
    const { SecureStorageService } = await import("../desktop/main/services/secureStorage");
    const storage = new SecureStorageService();

    await storage.delete("retired-key");

    await expect(readFile(storagePath, "utf8")).resolves.toBe(originalContent);
  });

  it("odstraní více legacy klíčů jedním zápisem a zachová relaci", async () => {
    const storagePath = join(electronMock.userDataPath, "secure-storage.json");
    await writeFile(storagePath, JSON.stringify({
      session: "encrypted-session",
      "retired-one": "secret-one",
      "retired-two": "secret-two",
    }), "utf8");
    const { SecureStorageService } = await import("../desktop/main/services/secureStorage");
    const storage = new SecureStorageService();

    await storage.deleteMany(["retired-one", "retired-two", "already-absent"]);

    await expect(readFile(storagePath, "utf8")).resolves.toBe(
      '{\n  "session": "encrypted-session"\n}',
    );
  });

  it("zachová obě souběžné mutace napříč instancemi služby", async () => {
    const storagePath = join(electronMock.userDataPath, "secure-storage.json");
    await writeFile(storagePath, "{}", "utf8");
    const { SecureStorageService } = await import("../desktop/main/services/secureStorage");
    const sessionStorage = new SecureStorageService();
    const settingsStorage = new SecureStorageService();

    await Promise.all([
      sessionStorage.set("session", "session-value"),
      settingsStorage.set("settings", "settings-value"),
    ]);

    await expect(readFile(storagePath, "utf8").then(JSON.parse)).resolves.toEqual({
      session: "async:v1:c2Vzc2lvbi12YWx1ZQ==",
      settings: "async:v1:c2V0dGluZ3MtdmFsdWU=",
    });
  });

  it("umožní první bezpečný zápis, když storage soubor ještě neexistuje", async () => {
    const storagePath = join(electronMock.userDataPath, "secure-storage.json");
    const { SecureStorageService } = await import("../desktop/main/services/secureStorage");
    const storage = new SecureStorageService();

    await storage.set("session", "encrypted-value");

    await expect(readFile(storagePath, "utf8")).resolves.toContain(
      '"session": "async:v1:ZW5jcnlwdGVkLXZhbHVl"',
    );
  });

  it("přečte starší synchronně šifrovaný záznam bez migrace do plaintextu", async () => {
    const storagePath = join(electronMock.userDataPath, "secure-storage.json");
    await writeFile(storagePath, '{"session":"bGVnYWN5LXNlY3JldA=="}', "utf8");
    const { SecureStorageService } = await import("../desktop/main/services/secureStorage");
    const storage = new SecureStorageService();

    await expect(storage.get("session")).resolves.toBe("legacy-secret");
  });

  it("použije stále bezpečný synchronní fallback, když async provider není dostupný", async () => {
    electronMock.asyncEncryptionAvailable = false;
    const storagePath = join(electronMock.userDataPath, "secure-storage.json");
    const { SecureStorageService } = await import("../desktop/main/services/secureStorage");
    const storage = new SecureStorageService();

    await storage.set("session", "sync-fallback-secret");

    await expect(readFile(storagePath, "utf8").then(JSON.parse)).resolves.toEqual({
      session: "c3luYy1mYWxsYmFjay1zZWNyZXQ=",
    });
  });

  it("odmítne zápis bez OS šifrování a nevytvoří plaintext soubor", async () => {
    electronMock.asyncEncryptionAvailable = false;
    electronMock.syncEncryptionAvailable = false;
    const storagePath = join(electronMock.userDataPath, "secure-storage.json");
    const { SecureStorageService } = await import("../desktop/main/services/secureStorage");
    const storage = new SecureStorageService();

    await expect(storage.set("session", "refresh-token-secret")).rejects.toMatchObject({
      code: "SECURE_STORAGE_UNAVAILABLE",
    });

    await expect(readFile(storagePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("odmítne zápis i když async provider dostupnost ohlásí, ale šifrování selže", async () => {
    electronMock.asyncEncryptError = new Error("Keychain operation failed");
    const storagePath = join(electronMock.userDataPath, "secure-storage.json");
    const { SecureStorageService } = await import("../desktop/main/services/secureStorage");
    const storage = new SecureStorageService();

    await expect(storage.set("session", "refresh-token-secret")).rejects.toMatchObject({
      code: "SECURE_STORAGE_UNAVAILABLE",
    });

    await expect(readFile(storagePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
