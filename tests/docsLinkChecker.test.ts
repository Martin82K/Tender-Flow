import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { validateDocumentation } from '../scripts/docs-link-checker.mjs';

const fixtureDirectories: string[] = [];

const createFixture = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'tender-flow-docs-'));
  fixtureDirectories.push(directory);
  mkdirSync(join(directory, 'docs'));
  return directory;
};

afterEach(() => {
  for (const directory of fixtureDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('documentation link checker', () => {
  it('accepts an existing local documentation link', () => {
    const root = createFixture();
    writeFileSync(join(root, 'README.md'), '[Guide](docs/guide.md)\n');
    writeFileSync(join(root, 'docs', 'guide.md'), '# Guide\n');

    expect(validateDocumentation(root)).toEqual([]);
  });

  it('reports a missing target with its source file', () => {
    const root = createFixture();
    writeFileSync(join(root, 'README.md'), '[Missing](docs/missing.md)\n');

    expect(validateDocumentation(root)).toEqual([
      {
        source: 'README.md',
        target: 'docs/missing.md',
      },
    ]);
  });

  it('ignores external URLs and links to an anchor in the current file', () => {
    const root = createFixture();
    writeFileSync(
      join(root, 'README.md'),
      '[Website](https://example.com)\n[Section](#section)\n',
    );

    expect(validateDocumentation(root)).toEqual([]);
  });

  it('finds no broken links in the repository documentation', () => {
    expect(validateDocumentation(process.cwd())).toEqual([]);
  });
});
