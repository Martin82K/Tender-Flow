import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { resolvePortablePath } from '../desktop/main/services/portablePathResolver';

interface MockDepsOptions {
  existingPaths?: string[];
  existingDirs?: string[];
  homeDirsByPath?: Record<string, string[]>;
}

const normalize = (targetPath: string): string => path.normalize(targetPath);

const createMockDeps = (options: MockDepsOptions = {}) => {
  const existingPaths = new Set((options.existingPaths || []).map(normalize));
  const existingDirs = new Set((options.existingDirs || []).map(normalize));
  const homeDirsByPath = options.homeDirsByPath || {};

  return {
    async pathExists(targetPath: string): Promise<boolean> {
      const normalized = normalize(targetPath);
      return existingPaths.has(normalized) || existingDirs.has(normalized);
    },
    async directoryExists(targetPath: string): Promise<boolean> {
      return existingDirs.has(normalize(targetPath));
    },
    async listHomeDirectories(homeDir: string): Promise<string[]> {
      return homeDirsByPath[normalize(homeDir)] || [];
    },
  };
};

describe('resolvePortablePath', () => {
  it('returns original path when original path already exists', async () => {
    const originalPath = 'C:\\Users\\marti\\OneDrive - BAU-STAV a.s\\Bazen - pracovni\\_TF';
    const onRemap = vi.fn();

    const resolved = await resolvePortablePath(originalPath, {
      mode: 'read',
      homeDir: 'C:\\Users\\marti',
      deps: createMockDeps({
        existingDirs: [originalPath],
      }),
      onRemap,
    });

    expect(resolved).toBe(originalPath);
    expect(onRemap).not.toHaveBeenCalled();
  });

  it('remaps read path by keeping suffix after OneDrive anchor', async () => {
    const sharedPath =
      'C:\\Users\\marti\\OneDrive - BAU-STAV a.s\\Bazen - pracovni\\_TF';
    const localMappedPath =
      'C:\\Users\\petr\\OneDrive - BAU-STAV a.s\\Bazen - pracovni\\_TF';
    const onRemap = vi.fn();

    const resolved = await resolvePortablePath(sharedPath, {
      mode: 'read',
      homeDir: 'C:\\Users\\petr',
      deps: createMockDeps({
        existingDirs: [
          'C:\\Users\\petr\\OneDrive - BAU-STAV a.s',
          localMappedPath,
        ],
        homeDirsByPath: {
          [normalize('C:\\Users\\petr')]: ['OneDrive - BAU-STAV a.s'],
        },
      }),
      onRemap,
    });

    expect(resolved).toBe(localMappedPath);
    expect(onRemap).toHaveBeenCalledTimes(1);
    expect(onRemap).toHaveBeenCalledWith(
      expect.objectContaining({
        from: sharedPath,
        to: localMappedPath,
        mode: 'read',
      }),
    );
  });

  it('returns original path when no local OneDrive candidate can be resolved', async () => {
    const sharedPath =
      'C:\\Users\\marti\\OneDrive - BAU-STAV a.s\\Bazen - pracovni\\_TF';

    const resolved = await resolvePortablePath(sharedPath, {
      mode: 'read',
      homeDir: 'C:\\Users\\petr',
      deps: createMockDeps({
        homeDirsByPath: {
          [normalize('C:\\Users\\petr')]: [],
        },
      }),
    });

    expect(resolved).toBe(sharedPath);
  });

  it('resolves in write mode even when final target path does not exist', async () => {
    const sharedPath =
      'C:\\Users\\marti\\OneDrive - BAU-STAV a.s\\Bazen - pracovni\\_TF\\03_Vyberova_rizeni';
    const expectedWriteTarget =
      'C:\\Users\\petr\\OneDrive - BAU-STAV a.s\\Bazen - pracovni\\_TF\\03_Vyberova_rizeni';

    const resolved = await resolvePortablePath(sharedPath, {
      mode: 'write',
      homeDir: 'C:\\Users\\petr',
      deps: createMockDeps({
        existingDirs: ['C:\\Users\\petr\\OneDrive - BAU-STAV a.s'],
        homeDirsByPath: {
          [normalize('C:\\Users\\petr')]: ['OneDrive - BAU-STAV a.s'],
        },
      }),
    });

    expect(resolved).toBe(expectedWriteTarget);
  });

  it('does not remap non-OneDrive paths', async () => {
    const regularPath = 'C:\\Data\\Projects\\Bazen\\_TF';

    const resolved = await resolvePortablePath(regularPath, {
      mode: 'read',
      homeDir: 'C:\\Users\\petr',
      deps: createMockDeps({
        existingDirs: ['C:\\Users\\petr\\OneDrive - BAU-STAV a.s'],
        homeDirsByPath: {
          [normalize('C:\\Users\\petr')]: ['OneDrive - BAU-STAV a.s'],
        },
      }),
    });

    expect(resolved).toBe(regularPath);
  });
});

