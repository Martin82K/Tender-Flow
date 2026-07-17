import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { BidComparisonFileConfig, BidComparisonStoredResult } from '../types';
import { createDefaultBidComparisonConfig, validateBidComparisonConfig } from './bidComparisonScoring';

export const BID_COMPARISON_CONFIG_FILE = 'porovnani-nabidek.config.json';
export const BID_COMPARISON_RESULT_FILE = 'porovnani-nabidek-latest.result.json';
const MAX_JSON_BYTES = 2 * 1024 * 1024;

const resolveSafeRoot = async (rootPath: string): Promise<string> => {
  const resolved = path.resolve(rootPath);
  const stat = await fs.lstat(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Složka VŘ musí být skutečný lokální adresář.');
  return fs.realpath(resolved);
};

export const resolveSafeWorkspaceFile = async (rootPath: string, fileName: string): Promise<string> => {
  if (path.basename(fileName) !== fileName || !/^[a-z0-9.-]+$/i.test(fileName)) throw new Error('Neplatný název souboru porovnání.');
  const root = await resolveSafeRoot(rootPath);
  const target = path.join(root, fileName);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Výstup musí být uvnitř složky VŘ.');
  try {
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Cílový soubor nesmí být symbolický odkaz.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return target;
};

const readJson = async (rootPath: string, fileName: string): Promise<unknown | null> => {
  const target = await resolveSafeWorkspaceFile(rootPath, fileName);
  try {
    const stat = await fs.stat(target);
    if (stat.size > MAX_JSON_BYTES) throw new Error(`${fileName} je příliš velký.`);
    return JSON.parse(await fs.readFile(target, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    if (error instanceof SyntaxError) throw new Error(`${fileName} obsahuje neplatný JSON.`);
    throw error;
  }
};

export const atomicWriteWorkspaceFile = async (rootPath: string, fileName: string, data: Buffer | string): Promise<string> => {
  const target = await resolveSafeWorkspaceFile(rootPath, fileName);
  const temporary = `${target}.tmp-${crypto.randomUUID()}`;
  try {
    await fs.writeFile(temporary, data, { flag: 'wx', mode: 0o600 });
    await fs.rename(temporary, target);
    return target;
  } finally {
    await fs.unlink(temporary).catch(() => undefined);
  }
};

export const loadBidComparisonConfig = async (rootPath: string): Promise<BidComparisonFileConfig> => {
  const raw = await readJson(rootPath, BID_COMPARISON_CONFIG_FILE);
  return raw == null ? createDefaultBidComparisonConfig() : validateBidComparisonConfig(raw as BidComparisonFileConfig);
};

export const saveBidComparisonConfig = async (rootPath: string, config: BidComparisonFileConfig): Promise<BidComparisonFileConfig> => {
  const validated = validateBidComparisonConfig(config);
  await atomicWriteWorkspaceFile(rootPath, BID_COMPARISON_CONFIG_FILE, `${JSON.stringify(validated, null, 2)}\n`);
  return validated;
};

export const loadBidComparisonResult = async (rootPath: string): Promise<BidComparisonStoredResult | null> => {
  const raw = await readJson(rootPath, BID_COMPARISON_RESULT_FILE);
  if (raw == null) return null;
  const result = raw as Partial<BidComparisonStoredResult>;
  if (result.version !== 1 || result.algorithmVersion !== '1.0.0' || !result.evaluation || !result.requestId) {
    throw new Error('Nepodporovaná nebo poškozená verze výsledku porovnání.');
  }
  return result as BidComparisonStoredResult;
};

export const saveBidComparisonResult = async (rootPath: string, result: BidComparisonStoredResult): Promise<string> =>
  atomicWriteWorkspaceFile(rootPath, BID_COMPARISON_RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`);

export const fingerprintFile = async (rootPath: string, filePath: string): Promise<{ fileName: string; sha256: string }> => {
  const root = await resolveSafeRoot(rootPath);
  const requestedFile = path.resolve(filePath);
  const requestedStat = await fs.lstat(requestedFile);
  if (requestedStat.isSymbolicLink() || !requestedStat.isFile()) throw new Error('Vstup nabídky musí být skutečný soubor, nikoliv symbolický odkaz.');
  const realFile = await fs.realpath(requestedFile);
  const relative = path.relative(root, realFile);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Vstupní soubor leží mimo složku VŘ.');
  const hash = crypto.createHash('sha256').update(await fs.readFile(realFile)).digest('hex');
  return { fileName: relative.replace(/\\/g, '/'), sha256: hash };
};
