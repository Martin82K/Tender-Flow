import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const inMemoryFiles = vi.hoisted(() => new Map<string, string>());
const secureStore = vi.hoisted(() => new Map<string, string>());

const fsMock = vi.hoisted(() => ({
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async (filePath: string, content: string) => {
    inMemoryFiles.set(filePath, content);
  }),
  readFile: vi.fn(async (filePath: string) => {
    const content = inMemoryFiles.get(filePath);
    if (content == null) throw new Error('ENOENT');
    return content;
  }),
  readdir: vi.fn(async () => []),
  stat: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: fsMock,
  ...fsMock,
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return '/Users/tester/user-data';
      if (name === 'documents') return '/Users/tester/documents';
      if (name === 'exe') return '/Applications/TenderFlow/TenderFlow.exe';
      return '/tmp';
    }),
  },
}));

vi.mock('../desktop/main/services/secureStorage', () => ({
  SecureStorageService: class {
    async get(key: string): Promise<string | null> {
      return secureStore.get(key) ?? null;
    }

    async set(key: string, value: string): Promise<void> {
      secureStore.set(key, value);
    }
  },
}));

describe('AutoBackupService security', () => {
  beforeEach(() => {
    inMemoryFiles.clear();
    secureStore.clear();
    fsMock.mkdir.mockClear();
    fsMock.writeFile.mockClear();
    fsMock.readFile.mockClear();
    fsMock.readdir.mockClear();
    fsMock.stat.mockClear();
    fsMock.unlink.mockClear();
  });

  it('ulozi a nacte sifrovanou zalohu jen uvnitr backup slozky', async () => {
    const { AutoBackupService } = await import('../desktop/main/services/autoBackupService');
    const service = new AutoBackupService();

    const orgId = '123e4567-e89b-12d3-a456-426614174000';
    const payload = '{"ok":true}';
    const savedPath = await service.saveBackup(payload, 'tenant', orgId);

    const expectedFolder = path.resolve('/Users/tester/documents/Tender Flow/Backups');
    expect(savedPath.startsWith(expectedFolder)).toBe(true);
    expect(savedPath.endsWith('.enc.json')).toBe(true);
    // writeFile je volán pro šifrovaný backup i pro persist settings — stačí ověřit, že backup proběhl
    expect(
      fsMock.writeFile.mock.calls.some(([filePath]) =>
        typeof filePath === 'string' && filePath.startsWith(expectedFolder),
      ),
    ).toBe(true);

    const content = await service.readBackup(savedPath);
    expect(content).toBe(payload);
  });

  it('odmitne path traversal v organizationId', async () => {
    const { AutoBackupService } = await import('../desktop/main/services/autoBackupService');
    const service = new AutoBackupService();

    await expect(service.saveBackup('{"x":1}', 'tenant', '../etc/passwd')).rejects.toThrow(
      'Invalid organization ID',
    );
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it('odmitne cteni souboru mimo backup slozku', async () => {
    const { AutoBackupService } = await import('../desktop/main/services/autoBackupService');
    const service = new AutoBackupService();

    await expect(service.readBackup('/etc/passwd.json')).rejects.toThrow('Invalid backup path');
    await expect(service.readBackup('../outside.json')).rejects.toThrow('Invalid backup path');
  });
});
