import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import ExcelJS from 'exceljs';
import type {
  BidComparisonDetectedFile,
  BidComparisonNormalizationResult,
  BidComparisonNormalizedItem,
} from '../types';

const EXTRACTION_PATH = '/v1/tender-flow/offer-extraction';
const NORMALIZED_DIR = 'porovnani-normalized';
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const EXTRACTION_TIMEOUT_MS = 60_000;
const MAX_ITEMS = 20_000;
const MIN_AUTOMATIC_CONFIDENCE = 0.75;

const FORMAT_BY_EXTENSION: Record<string, NonNullable<BidComparisonDetectedFile['sourceFormat']>> = {
  '.xlsx': 'xlsx', '.xls': 'xls', '.xlsm': 'xlsm', '.csv': 'csv',
  '.pdf': 'pdf', '.doc': 'doc', '.docx': 'docx',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.tif': 'image', '.tiff': 'image',
};

const MIME_BY_EXTENSION: Record<string, string> = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroenabled.12',
  '.csv': 'text/csv', '.pdf': 'application/pdf', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.tif': 'image/tiff', '.tiff': 'image/tiff',
};

export const getBidComparisonSourceFormat = (fileName: string): BidComparisonDetectedFile['sourceFormat'] | null =>
  FORMAT_BY_EXTENSION[path.extname(fileName).toLowerCase()] || null;

export const isSupportedBidComparisonSource = (fileName: string): boolean =>
  getBidComparisonSourceFormat(fileName) != null;

const safeText = (value: unknown, maxLength: number): string =>
  String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, maxLength);

const safeNumber = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  const compact = String(value).replace(/\s/g, '').replace(/Kč|CZK/gi, '');
  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  const decimalSeparator = lastComma > lastDot ? ',' : lastDot >= 0 ? '.' : '';
  const normalized = decimalSeparator
    ? `${compact.slice(0, Math.max(lastComma, lastDot)).replace(/[.,]/g, '')}.${compact.slice(Math.max(lastComma, lastDot) + 1).replace(/[.,]/g, '')}`
    : compact.replace(/[.,]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const normalizeItem = (raw: unknown, purpose: 'offer' | 'reference'): BidComparisonNormalizedItem | null => {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const popis = safeText(source.popis ?? source.description ?? source.name, 1_000);
  if (!popis) return null;
  const confidenceRaw = Number(source.confidence ?? 1);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0;
  const jcena = safeNumber(source.jcena ?? source.unitPrice);
  const celkem = safeNumber(source.celkem ?? source.totalPrice);
  const reviewRequired = source.reviewRequired === true || confidence < MIN_AUTOMATIC_CONFIDENCE || (purpose === 'offer' && jcena == null && celkem == null);
  return {
    pc: safeText(source.pc ?? source.position, 120) || null,
    kod: safeText(source.kod ?? source.code, 160) || null,
    popis,
    mj: safeText(source.mj ?? source.unit, 80) || null,
    mnozstvi: safeNumber(source.mnozstvi ?? source.quantity),
    jcena,
    celkem,
    confidence,
    reviewRequired,
  };
};

const parseDelimited = (text: string, delimiter: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted;
      continue;
    }
    if (!quoted && char === delimiter) { row.push(cell); cell = ''; continue; }
    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
};

const normalizeHeader = (value: string): string => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const HEADER_ALIASES: Record<keyof Omit<BidComparisonNormalizedItem, 'confidence' | 'reviewRequired'>, string[]> = {
  pc: ['pc', 'p c', 'por c', 'poradi', 'pozice', 'cislo'], kod: ['kod', 'code', 'cislo polozky', 'katalogove cislo'],
  popis: ['popis', 'nazev', 'nazev polozky', 'description', 'polozka', 'predmet'], mj: ['mj', 'jednotka', 'merna jednotka', 'unit'],
  mnozstvi: ['mnozstvi', 'mnoz', 'pocet', 'qty', 'quantity'],
  jcena: ['j cena', 'jcena', 'jednotkova cena', 'jednotkova cena bez dph', 'cena za mj', 'cena mj', 'unit price'],
  celkem: ['celkem', 'cena celkem', 'cena celkem bez dph', 'celkova cena', 'total', 'total price'],
};

const parseCsvOffer = async (filePath: string, purpose: 'offer' | 'reference'): Promise<BidComparisonNormalizedItem[]> => {
  const source = await fs.readFile(filePath);
  const utf8 = source.toString('utf8');
  const decoded = utf8.includes('\uFFFD') ? new TextDecoder('windows-1250').decode(source) : utf8;
  const text = decoded.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delimiter = [';', ',', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = parseDelimited(text, delimiter);
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    const hasDescription = headers.some((cell) => HEADER_ALIASES.popis.includes(cell));
    const hasPrice = headers.some((cell) => [...HEADER_ALIASES.jcena, ...HEADER_ALIASES.celkem].includes(cell));
    return hasDescription && (purpose === 'reference' || hasPrice);
  });
  if (headerIndex < 0) throw new Error(purpose === 'reference' ? 'V CSV poptávce nebyla nalezena hlavička s popisem položky.' : 'V CSV nabídce nebyla nalezena hlavička s popisem a cenou.');
  const headers = rows[headerIndex].map(normalizeHeader);
  const indexes = Object.fromEntries(Object.entries(HEADER_ALIASES).map(([key, aliases]) => [key, headers.findIndex((header) => aliases.includes(header))])) as Record<string, number>;
  return rows.slice(headerIndex + 1).map((row, index) => normalizeItem({
    pc: indexes.pc >= 0 ? row[indexes.pc] : String(index + 1), kod: indexes.kod >= 0 ? row[indexes.kod] : null,
    popis: indexes.popis >= 0 ? row[indexes.popis] : null, mj: indexes.mj >= 0 ? row[indexes.mj] : null,
    mnozstvi: indexes.mnozstvi >= 0 ? row[indexes.mnozstvi] : null, jcena: indexes.jcena >= 0 ? row[indexes.jcena] : null,
    celkem: indexes.celkem >= 0 ? row[indexes.celkem] : null, confidence: 1,
  }, purpose)).filter((item): item is BidComparisonNormalizedItem => item != null);
};

const resolveEndpoint = (baseUrl: string): string => {
  const parsed = new URL(baseUrl);
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && local)) throw new Error('Extrakční API musí používat HTTPS.');
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, '')}${EXTRACTION_PATH}`.replace(/\/{2,}/g, '/');
  parsed.search = ''; parsed.hash = '';
  return parsed.toString();
};

const readResponseTextLimited = async (response: Response): Promise<string> => {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error('Extrakční API vrátilo příliš velkou odpověď.');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Extrakční API vrátilo příliš velkou odpověď.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
};

const extractRemotely = async (filePath: string, baseUrl: string, secret: string, requestId: string, purpose: 'offer' | 'reference'): Promise<{ items: BidComparisonNormalizedItem[]; warnings: string[] }> => {
  if (!secret.trim()) throw new Error('Pro extrakci dokumentové nabídky chybí bezpečně uložený API token.');
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_SOURCE_BYTES) throw new Error('Nabídka překračuje limit 25 MB pro vzdálenou extrakci.');
  const extension = path.extname(filePath).toLowerCase();
  const form = new FormData();
  const buffer = await fs.readFile(filePath);
  form.append('file', new Blob([buffer], { type: MIME_BY_EXTENSION[extension] || 'application/octet-stream' }), path.basename(filePath));
  form.append('requestId', requestId);
  form.append('schemaVersion', '1');
  form.append('contentRole', 'untrusted-business-data');
  form.append('allowedTask', purpose === 'reference' ? 'reference-item-extraction-only' : 'price-item-extraction-only');
  form.append('documentPurpose', purpose);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);
  try {
    const response = await fetch(resolveEndpoint(baseUrl), {
      method: 'POST', headers: { authorization: `Bearer ${secret.trim()}`, 'x-request-id': requestId, 'idempotency-key': requestId },
      body: form, signal: controller.signal,
    });
    const responseText = await readResponseTextLimited(response);
    if (!response.ok) throw new Error(`Extrakční API vrátilo HTTP ${response.status}.`);
    let parsed: unknown;
    try { parsed = JSON.parse(responseText); } catch { throw new Error('Extrakční API nevrátilo platný JSON.'); }
    const payload = parsed as Record<string, unknown>;
    if (payload.version !== 1) throw new Error('Extrakční API vrátilo nepodporovanou verzi odpovědi.');
    const items = Array.isArray(payload.items) ? payload.items.map((item) => normalizeItem(item, purpose)).filter((item): item is BidComparisonNormalizedItem => item != null).slice(0, MAX_ITEMS) : [];
    if (!items.length) throw new Error('V nabídce nebyly nalezeny žádné cenové položky.');
    const warnings = Array.isArray(payload.warnings) ? payload.warnings.map((warning) => safeText(warning, 500)).filter(Boolean).slice(0, 100) : [];
    return { items, warnings };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Extrakce nabídky překročila časový limit.');
    throw error;
  } finally { clearTimeout(timeout); }
};

const safeSegment = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'nabidka';

const persistNormalization = async (rootPath: string, supplierName: string, result: BidComparisonNormalizationResult): Promise<{ jsonPath: string; workbookPath: string }> => {
  const root = await fs.realpath(path.resolve(rootPath));
  const directory = path.join(root, NORMALIZED_DIR);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const directoryStat = await fs.lstat(directory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) throw new Error('Normalizační složka nesmí být symbolický odkaz.');
  const stem = `${safeSegment(supplierName)}-${result.sourceSha256.slice(0, 12)}`;
  const jsonPath = path.join(directory, `${stem}.json`);
  const workbookPath = path.join(directory, `${stem}.xlsx`);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Normalizovaná nabídka');
  sheet.addRow(['PČ', 'Typ', 'Kód', 'Popis', 'MJ', 'Množství', 'J.cena [CZK]', 'Cena celkem [CZK]', 'Confidence', 'Kontrola']);
  result.items.forEach((item, index) => sheet.addRow([item.pc || String(index + 1), item.reviewRequired ? 'N' : 'K', item.kod || '', item.popis, item.mj || '', item.mnozstvi, item.jcena, item.celkem, item.confidence, item.reviewRequired ? 'ANO' : 'NE']));
  const workbookBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const writeAtomic = async (target: string, data: Buffer | string) => {
    const temporary = `${target}.tmp-${crypto.randomUUID()}`;
    try { await fs.writeFile(temporary, data, { flag: 'wx', mode: 0o600 }); await fs.rename(temporary, target); }
    finally { await fs.unlink(temporary).catch(() => undefined); }
  };
  await writeAtomic(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  await writeAtomic(workbookPath, workbookBuffer);
  return { jsonPath, workbookPath };
};

export const persistBidComparisonNormalization = async (args: {
  rootPath: string;
  sourcePath: string;
  supplierName: string;
  purpose: 'offer' | 'reference';
  items: BidComparisonNormalizedItem[];
  warnings?: string[];
}): Promise<{ result: BidComparisonNormalizationResult; workbookPath: string; jsonPath: string }> => {
  const root = await fs.realpath(path.resolve(args.rootPath));
  const requested = path.resolve(args.sourcePath);
  const stat = await fs.lstat(requested);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Zdrojová nabídka musí být skutečný soubor.');
  if (stat.size > MAX_SOURCE_BYTES) throw new Error('Nabídka překračuje limit 25 MB pro zpracování.');
  const realFile = await fs.realpath(requested);
  const relative = path.relative(root, realFile);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Zdrojová nabídka leží mimo složku VŘ.');
  const sourceFormat = getBidComparisonSourceFormat(realFile);
  if (!sourceFormat) throw new Error('Nepodporovaný formát cenové nabídky.');
  const items = args.items.slice(0, MAX_ITEMS);
  if (!items.length) throw new Error('V nabídce nebyly nalezeny žádné použitelné položky.');
  const reviewCount = items.filter((item) => item.reviewRequired).length;
  const warnings = [...(args.warnings || [])];
  if (reviewCount) warnings.push(`${reviewCount} položek vyžaduje kontrolu kvůli nejistému párování nebo chybějící ceně.`);
  const result: BidComparisonNormalizationResult = {
    version: 1,
    sourceFileName: relative.replace(/\\/g, '/'),
    sourceSha256: crypto.createHash('sha256').update(await fs.readFile(realFile)).digest('hex'),
    sourceFormat,
    supplierName: safeText(args.supplierName, 240),
    purpose: args.purpose,
    generatedAt: new Date().toISOString(),
    extractor: 'remote-api',
    items,
    warnings,
    reviewRequired: reviewCount > 0,
  };
  return { result, ...(await persistNormalization(root, args.supplierName, result)) };
};

export const normalizeBidComparisonOffer = async (args: {
  rootPath: string; filePath: string; supplierName: string; baseUrl: string; secret: string; requestId: string; purpose?: 'offer' | 'reference';
}): Promise<{ result: BidComparisonNormalizationResult; workbookPath: string; jsonPath: string }> => {
  const root = await fs.realpath(path.resolve(args.rootPath));
  const requested = path.resolve(args.filePath);
  const stat = await fs.lstat(requested);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Zdrojová nabídka musí být skutečný soubor.');
  if (stat.size > MAX_SOURCE_BYTES) throw new Error('Nabídka překračuje limit 25 MB pro zpracování.');
  const realFile = await fs.realpath(requested);
  const relative = path.relative(root, realFile);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Zdrojová nabídka leží mimo složku VŘ.');
  const format = getBidComparisonSourceFormat(realFile);
  if (!format) throw new Error('Nepodporovaný formát cenové nabídky.');
  const sourceSha256 = crypto.createHash('sha256').update(await fs.readFile(realFile)).digest('hex');
  const purpose = args.purpose || 'offer';
  const csvItems = format === 'csv' ? await parseCsvOffer(realFile, purpose) : null;
  const extracted = csvItems
    ? {
        items: csvItems.slice(0, MAX_ITEMS),
        warnings: csvItems.length > MAX_ITEMS ? [`CSV obsahuje více než ${MAX_ITEMS} položek; další řádky nebyly načteny.`] : [],
      }
    : await extractRemotely(realFile, args.baseUrl, args.secret, args.requestId, purpose);
  if (!extracted.items.length) throw new Error('V nabídce nebyly nalezeny žádné použitelné položky.');
  const reviewCount = extracted.items.filter((item) => item.reviewRequired).length;
  const warnings = [...extracted.warnings];
  if (reviewCount) warnings.push(`${reviewCount} položek vyžaduje kontrolu kvůli nízké jistotě nebo chybějící ceně.`);
  const result: BidComparisonNormalizationResult = {
    version: 1, sourceFileName: relative.replace(/\\/g, '/'), sourceSha256, sourceFormat: format,
    supplierName: safeText(args.supplierName, 240), purpose, generatedAt: new Date().toISOString(),
    extractor: format === 'csv' ? 'local-csv' : 'remote-api', items: extracted.items, warnings,
    reviewRequired: reviewCount > 0,
  };
  const persisted = await persistNormalization(root, args.supplierName, result);
  return { result, ...persisted };
};
