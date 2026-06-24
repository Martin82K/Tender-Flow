import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_TARGETS = [
    'app',
    'components',
    'config',
    'desktop/main',
    'desktop/README.md',
    'features',
    'hooks',
    'package.json',
    'scripts',
    'server',
    'server.js',
    'services',
    'shared',
    'utils',
];

const IGNORED_DIRS = new Set([
    '.git',
    'dist',
    'dist-electron',
    'node_modules',
]);

const SOURCE_EXTENSIONS = new Set([
    '.cjs',
    '.js',
    '.json',
    '.md',
    '.mjs',
    '.ts',
    '.tsx',
    '.yml',
    '.yaml',
]);

const getExtension = (filePath: string): string => {
    const dotIndex = filePath.lastIndexOf('.');
    return dotIndex === -1 ? '' : filePath.slice(dotIndex);
};

const collectFiles = (targetPath: string): string[] => {
    if (!existsSync(targetPath)) return [];

    const stat = statSync(targetPath);
    if (stat.isFile()) {
        return SOURCE_EXTENSIONS.has(getExtension(targetPath)) ? [targetPath] : [];
    }

    if (!stat.isDirectory()) return [];

    return readdirSync(targetPath).flatMap((entry) => {
        if (IGNORED_DIRS.has(entry)) return [];
        return collectFiles(join(targetPath, entry));
    });
};

const scannedFiles = SCAN_TARGETS.flatMap((target) => collectFiles(join(ROOT_DIR, target)));

const forbiddenPatterns = [
    {
        label: 'Git credential helper access',
        pattern: new RegExp(['git', 'credential', 'fill'].join('\\s+'), 'i'),
    },
    {
        label: 'GitHub user token environment variable',
        pattern: new RegExp(`\\b(?:${'GH'}|${'GITHUB'})${'_TOKEN'}\\b`),
    },
    {
        label: 'Direct GitHub API calls from app scripts',
        pattern: new RegExp(`\\b${'api'}\\.${'github'}\\.com\\b`, 'i'),
    },
    {
        label: 'Basic authorization header construction',
        pattern: new RegExp(`${'Authorization'}['"]?\\s*:\\s*['"]${'Basic'}\\s+`, 'i'),
    },
];

describe('GitHub credential security', () => {
    it('does not allow local GitHub credential or token based release automation', () => {
        const violations = scannedFiles.flatMap((filePath) => {
            const source = readFileSync(filePath, 'utf8');
            return forbiddenPatterns
                .filter(({ pattern }) => pattern.test(source))
                .map(({ label }) => `${relative(ROOT_DIR, filePath)}: ${label}`);
        });

        expect(violations).toEqual([]);
    });
});
