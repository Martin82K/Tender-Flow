import * as fs from 'fs/promises';
import * as path from 'path';

type ResolveMode = 'read' | 'write';

interface ResolverDeps {
  pathExists: (targetPath: string) => Promise<boolean>;
  directoryExists: (targetPath: string) => Promise<boolean>;
  listHomeDirectories: (homeDir: string) => Promise<string[]>;
}

interface ResolvePortablePathOptions {
  mode: ResolveMode;
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
  deps?: ResolverDeps;
  onRemap?: (details: {
    from: string;
    to: string;
    mode: ResolveMode;
    anchorSegment: string;
  }) => void;
}

const ONEDRIVE_SEGMENT_RE = /^OneDrive(?:\s-\s.+)?$/i;

const trimWrappingQuotes = (value: string): string => value.trim().replace(/^"(.*)"$/, '$1');

const normalizeKey = (value: string): string => {
  const normalized = path.normalize(value).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
};

const splitPathSegments = (targetPath: string): string[] =>
  targetPath.split(/[\\/]+/).filter(Boolean);

const findOneDriveAnchorIndex = (segments: string[]): number =>
  segments.findIndex((segment) => ONEDRIVE_SEGMENT_RE.test(segment));

const defaultDeps: ResolverDeps = {
  async pathExists(targetPath: string): Promise<boolean> {
    try {
      await fs.stat(targetPath);
      return true;
    } catch {
      return false;
    }
  },
  async directoryExists(targetPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(targetPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  },
  async listHomeDirectories(homeDir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(homeDir, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {
      return [];
    }
  },
};

const collectCandidateBases = async (
  anchorSegment: string,
  homeDir: string | undefined,
  env: NodeJS.ProcessEnv,
  deps: ResolverDeps,
): Promise<string[]> => {
  const rawCandidates: string[] = [];

  const pushEnvPath = (value: string | undefined): void => {
    const trimmed = value ? trimWrappingQuotes(value) : '';
    if (trimmed) rawCandidates.push(trimmed);
  };

  pushEnvPath(env.OneDriveCommercial);
  pushEnvPath(env.OneDrive);
  pushEnvPath(env.OneDriveConsumer);

  if (homeDir) {
    rawCandidates.push(path.join(homeDir, anchorSegment));
    rawCandidates.push(path.join(homeDir, 'OneDrive'));

    const homeDirs = await deps.listHomeDirectories(homeDir);
    homeDirs
      .filter((entry) => ONEDRIVE_SEGMENT_RE.test(entry))
      .forEach((entry) => rawCandidates.push(path.join(homeDir, entry)));
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const candidate of rawCandidates) {
    if (!candidate) continue;
    const normalized = path.normalize(candidate);
    const key = normalizeKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
  }

  return deduped;
};

const scoreBaseCandidate = (candidateBase: string, anchorSegment: string): number => {
  const baseName = path.basename(candidateBase).toLowerCase();
  const anchor = anchorSegment.toLowerCase();
  if (baseName === anchor) return 100;
  if (baseName.startsWith('onedrive -') && anchor.startsWith('onedrive -')) return 80;
  if (baseName === 'onedrive' && anchor === 'onedrive') return 70;
  if (baseName.startsWith('onedrive')) return 60;
  return 0;
};

const buildJoinedCandidate = (basePath: string, suffixSegments: string[]): string =>
  suffixSegments.length > 0 ? path.join(basePath, ...suffixSegments) : basePath;

const resolveUsingExistingTarget = async (
  candidateBases: string[],
  suffixSegments: string[],
  deps: ResolverDeps,
): Promise<string | null> => {
  for (const base of candidateBases) {
    const candidateTarget = buildJoinedCandidate(base, suffixSegments);
    if (await deps.pathExists(candidateTarget)) {
      return candidateTarget;
    }
  }
  return null;
};

const resolveUsingExistingBase = async (
  candidateBases: string[],
  suffixSegments: string[],
  anchorSegment: string,
  deps: ResolverDeps,
): Promise<string | null> => {
  const sorted = [...candidateBases].sort(
    (a, b) => scoreBaseCandidate(b, anchorSegment) - scoreBaseCandidate(a, anchorSegment),
  );

  for (const base of sorted) {
    if (await deps.directoryExists(base)) {
      return buildJoinedCandidate(base, suffixSegments);
    }
  }
  return null;
};

export const resolvePortablePath = async (
  inputPath: string,
  options: ResolvePortablePathOptions,
): Promise<string> => {
  const fromPath = trimWrappingQuotes(inputPath || '');
  if (!fromPath) return inputPath;

  const deps = options.deps || defaultDeps;
  const mode = options.mode;

  if (await deps.pathExists(fromPath)) {
    return fromPath;
  }

  const segments = splitPathSegments(fromPath);
  const anchorIndex = findOneDriveAnchorIndex(segments);
  if (anchorIndex < 0) {
    return fromPath;
  }

  const anchorSegment = segments[anchorIndex];
  const suffixSegments = segments.slice(anchorIndex + 1);

  const env = options.env || process.env;
  const candidateBases = await collectCandidateBases(
    anchorSegment,
    options.homeDir,
    env,
    deps,
  );

  if (candidateBases.length === 0) {
    return fromPath;
  }

  let resolvedPath = await resolveUsingExistingTarget(candidateBases, suffixSegments, deps);
  if (!resolvedPath && mode === 'write') {
    resolvedPath = await resolveUsingExistingBase(candidateBases, suffixSegments, anchorSegment, deps);
  }

  if (!resolvedPath || normalizeKey(resolvedPath) === normalizeKey(fromPath)) {
    return fromPath;
  }

  options.onRemap?.({
    from: fromPath,
    to: resolvedPath,
    mode,
    anchorSegment,
  });

  return resolvedPath;
};

