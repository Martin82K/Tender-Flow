import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  userDataPath: "",
}));

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => electronMock.userDataPath),
  },
  safeStorage: {
    decryptString: vi.fn((value: Buffer) => value.toString("utf8")),
    encryptString: vi.fn((value: string) => Buffer.from(value, "utf8")),
    isEncryptionAvailable: vi.fn(() => true),
  },
}));

describe("SecureStorageService", () => {
  beforeEach(async () => {
    electronMock.userDataPath = await mkdtemp(join(tmpdir(), "tender-flow-secure-storage-"));
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
      session: "c2Vzc2lvbi12YWx1ZQ==",
      settings: "c2V0dGluZ3MtdmFsdWU=",
    });
  });

  it("umožní první bezpečný zápis, když storage soubor ještě neexistuje", async () => {
    const storagePath = join(electronMock.userDataPath, "secure-storage.json");
    const { SecureStorageService } = await import("../desktop/main/services/secureStorage");
    const storage = new SecureStorageService();

    await storage.set("session", "encrypted-value");

    await expect(readFile(storagePath, "utf8")).resolves.toContain('"session": "ZW5jcnlwdGVkLXZhbHVl"');
  });
});
