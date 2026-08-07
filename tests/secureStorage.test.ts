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

  it("umožní první bezpečný zápis, když storage soubor ještě neexistuje", async () => {
    const storagePath = join(electronMock.userDataPath, "secure-storage.json");
    const { SecureStorageService } = await import("../desktop/main/services/secureStorage");
    const storage = new SecureStorageService();

    await storage.set("session", "encrypted-value");

    await expect(readFile(storagePath, "utf8")).resolves.toContain('"session": "ZW5jcnlwdGVkLXZhbHVl"');
  });
});
