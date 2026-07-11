import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const markdownLinkPattern = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g;
const externalTargetPattern = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i;

const toPortablePath = (path) => path.split(sep).join('/');

const collectMarkdownFiles = (directory) => {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectMarkdownFiles(path);
    }

    return entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
  });
};

const normalizeTarget = (rawTarget) => {
  const trimmedTarget = rawTarget.trim();
  const withoutBrackets = trimmedTarget.startsWith('<') && trimmedTarget.endsWith('>')
    ? trimmedTarget.slice(1, -1)
    : trimmedTarget;
  const targetWithoutAnchor = withoutBrackets.split('#', 1)[0];

  try {
    return decodeURIComponent(targetWithoutAnchor);
  } catch {
    return targetWithoutAnchor;
  }
};

export const validateDocumentation = (rootDirectory) => {
  const root = resolve(rootDirectory);
  const rootReadme = join(root, 'README.md');
  const markdownFiles = [
    ...(existsSync(rootReadme) ? [rootReadme] : []),
    ...collectMarkdownFiles(join(root, 'docs')),
  ];

  return markdownFiles.flatMap((sourcePath) => {
    const markdown = readFileSync(sourcePath, 'utf8');
    const findings = [];

    for (const match of markdown.matchAll(markdownLinkPattern)) {
      const rawTarget = match[1].trim();
      if (externalTargetPattern.test(rawTarget)) {
        continue;
      }

      const target = normalizeTarget(rawTarget);
      if (!target || existsSync(resolve(dirname(sourcePath), target))) {
        continue;
      }

      findings.push({
        source: toPortablePath(relative(root, sourcePath)),
        target: rawTarget,
      });
    }

    return findings;
  });
};
