import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  BidComparisonAgentConfig,
  BidComparisonAgentRecommendation,
  BidComparisonAgentTestResult,
  BidComparisonNormalizedItem,
  BidComparisonSelectedFileInput,
} from '../types';
import { getBidComparisonSourceFormat, persistBidComparisonNormalization } from './bidComparisonNormalization';

const ANALYZE_PATH = '/v1/tender-flow/analyze';
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 20;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 120_000;
const MIN_TIMEOUT_MS = 5_000;

const MIME_BY_EXTENSION: Record<string, string> = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroenabled.12',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
};

interface HermesReferenceItem {
  referenceItemId: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  sourceText: string;
  uncertainty: string | null;
}

interface HermesOfferMatch {
  supplierId: string;
  offerItemDescription: string | null;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  currency: string | null;
  matchStatus: 'matched' | 'uncertain' | 'unmatched';
  uncertainty: string | null;
}

interface HermesAnalyzeResponse {
  schemaVersion: 1;
  requestId: string;
  referenceItems: HermesReferenceItem[];
  suppliers: Array<{ supplierId: string; supplierName: string; round: string; localScore: number | null }>;
  matrix: Array<{ referenceItemId: string; offers: HermesOfferMatch[] }>;
  findings: Array<{ severity: 'info' | 'warning' | 'risk'; code: string; message: string; supplierId: string | null; referenceItemId: string | null }>;
  summary: string;
  risks: Array<{ severity: 'low' | 'medium' | 'high'; message: string; relatedSupplierIds: string[] }>;
  recommendedChecks: string[];
}

export interface HermesNormalizedOffer {
  supplierName: string;
  round: number;
  variant: number;
  workbookPath: string;
  result: Awaited<ReturnType<typeof persistBidComparisonNormalization>>['result'];
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isNullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';
const isNullableNumber = (value: unknown): value is number | null => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
const boundedText = (value: string, max = 1_000): string => value.replace(/[\u0000-\u001F]/g, '').trim().slice(0, max);

const assertNoAgentDecisionFields = (value: unknown, parentKey = ''): void => {
  if (Array.isArray(value)) {
    value.forEach((item) => assertNoAgentDecisionFields(item, parentKey));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    const forbidden = ['winner', 'recommendedwinner', 'score', 'generatedscore', 'rank', 'rating', 'points'];
    if (forbidden.includes(normalized) && !(key === 'localScore' && parentKey === 'suppliers')) {
      throw new Error('Hermes API se pokusilo vrátit nepovolené skóre nebo výběr vítěze.');
    }
    assertNoAgentDecisionFields(child, key === 'suppliers' ? 'suppliers' : key);
  }
};

const resolveEndpoint = (baseUrl: string): string => {
  const parsed = new URL(baseUrl);
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && local)) throw new Error('Hermes API musí používat HTTPS.');
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, '')}${ANALYZE_PATH}`.replace(/\/{2,}/g, '/');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
};

const resolveTimeout = (timeoutMs: number | undefined): number => {
  if (!Number.isFinite(timeoutMs)) return TIMEOUT_MS;
  return Math.max(MIN_TIMEOUT_MS, Math.min(TIMEOUT_MS, Math.floor(timeoutMs as number)));
};

const readResponseTextLimited = async (response: Response): Promise<string> => {
  const declared = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new Error('Hermes API vrátilo příliš velkou odpověď.');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Hermes API vrátilo příliš velkou odpověď.');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
};

const validateResponse = (value: unknown, requestId: string, expectedSuppliers: Map<string, { name: string; round: string }>): HermesAnalyzeResponse => {
  assertNoAgentDecisionFields(value);
  if (!isRecord(value) || value.schemaVersion !== 1 || value.requestId !== requestId) throw new Error('Hermes API vrátilo neplatný kontrakt nebo request ID.');
  if (!Array.isArray(value.referenceItems) || !Array.isArray(value.suppliers) || !Array.isArray(value.matrix) || !Array.isArray(value.findings) || !Array.isArray(value.risks) || !Array.isArray(value.recommendedChecks) || typeof value.summary !== 'string') {
    throw new Error('Hermes API vrátilo neúplnou odpověď.');
  }
  const ids = new Set<string>();
  for (const supplier of value.suppliers) {
    if (!isRecord(supplier) || typeof supplier.supplierId !== 'string' || typeof supplier.supplierName !== 'string' || typeof supplier.round !== 'string' || supplier.localScore !== null) throw new Error('Hermes API změnilo nebo doplnilo lokální skóre.');
    const expected = expectedSuppliers.get(supplier.supplierId);
    if (!expected || expected.name !== supplier.supplierName || expected.round !== supplier.round || ids.has(supplier.supplierId)) throw new Error('Hermes API vrátilo neznámého nebo změněného dodavatele.');
    ids.add(supplier.supplierId);
  }
  if (ids.size !== expectedSuppliers.size) throw new Error('Hermes API nevrátilo všechny nabídky.');
  const referenceIds = new Set<string>();
  for (const item of value.referenceItems) {
    if (!isRecord(item) || typeof item.referenceItemId !== 'string' || !item.referenceItemId || typeof item.description !== 'string' || !isNullableNumber(item.quantity) || !isNullableString(item.unit) || typeof item.sourceText !== 'string' || !isNullableString(item.uncertainty) || referenceIds.has(item.referenceItemId)) throw new Error('Hermes API vrátilo neplatnou referenční položku.');
    referenceIds.add(item.referenceItemId);
  }
  const matrixIds = new Set<string>();
  for (const row of value.matrix) {
    if (!isRecord(row) || typeof row.referenceItemId !== 'string' || !referenceIds.has(row.referenceItemId) || !Array.isArray(row.offers)) throw new Error('Hermes API vrátilo matici s neznámou položkou.');
    if (matrixIds.has(row.referenceItemId)) throw new Error('Hermes API vrátilo duplicitní řádek matice.');
    matrixIds.add(row.referenceItemId);
    const rowSupplierIds = new Set<string>();
    for (const offer of row.offers) {
      if (!isRecord(offer) || typeof offer.supplierId !== 'string' || !expectedSuppliers.has(offer.supplierId) || !isNullableString(offer.offerItemDescription) || !isNullableNumber(offer.quantity) || !isNullableNumber(offer.unitPrice) || !isNullableNumber(offer.totalPrice) || !isNullableString(offer.currency) || !['matched', 'uncertain', 'unmatched'].includes(String(offer.matchStatus)) || !isNullableString(offer.uncertainty)) throw new Error('Hermes API vrátilo neplatné párování nabídky.');
      if (rowSupplierIds.has(offer.supplierId)) throw new Error('Hermes API vrátilo duplicitní nabídku v řádku matice.');
      rowSupplierIds.add(offer.supplierId);
    }
  }
  for (const finding of value.findings) {
    if (!isRecord(finding) || !['info', 'warning', 'risk'].includes(String(finding.severity)) || typeof finding.code !== 'string' || typeof finding.message !== 'string' || !isNullableString(finding.supplierId) || !isNullableString(finding.referenceItemId) || (finding.supplierId !== null && !expectedSuppliers.has(finding.supplierId)) || (finding.referenceItemId !== null && !referenceIds.has(finding.referenceItemId))) throw new Error('Hermes API vrátilo neplatné zjištění.');
  }
  for (const risk of value.risks) {
    if (!isRecord(risk) || !['low', 'medium', 'high'].includes(String(risk.severity)) || typeof risk.message !== 'string' || !Array.isArray(risk.relatedSupplierIds) || risk.relatedSupplierIds.some((id) => typeof id !== 'string' || !expectedSuppliers.has(id))) throw new Error('Hermes API vrátilo neplatné riziko.');
  }
  if (value.recommendedChecks.some((check) => typeof check !== 'string')) throw new Error('Hermes API vrátilo neplatný doporučený krok.');
  return value as unknown as HermesAnalyzeResponse;
};

const secureSource = async (rootPath: string, filePath: string): Promise<{ realPath: string; buffer: Buffer }> => {
  const root = await fs.realpath(path.resolve(rootPath));
  const requested = path.resolve(filePath);
  const stat = await fs.lstat(requested);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Vstup musí být skutečný soubor, nikoli symbolický odkaz.');
  if (stat.size > MAX_FILE_BYTES) throw new Error(`Soubor ${path.basename(filePath)} překračuje limit 25 MB.`);
  const realPath = await fs.realpath(requested);
  const relative = path.relative(root, realPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Vstupní soubor leží mimo složku VŘ.');
  if (!getBidComparisonSourceFormat(realPath)) throw new Error(`Soubor ${path.basename(filePath)} má nepodporovaný formát.`);
  return { realPath, buffer: await fs.readFile(realPath) };
};

export const analyzeBidComparisonWithHermes = async (args: {
  rootPath: string;
  reference?: BidComparisonSelectedFileInput;
  offers: Array<BidComparisonSelectedFileInput & { supplierName: string; round: number; variant: number }>;
  baseUrl: string;
  secret: string;
  requestId: string;
}): Promise<{ offers: HermesNormalizedOffer[]; referenceWorkbookPath?: string; recommendation: BidComparisonAgentRecommendation }> => {
  if (!args.secret.trim()) throw new Error('Pro zpracování dokumentových nabídek chybí bezpečně uložený API token.');
  if (!args.offers.length || args.offers.length + (args.reference ? 1 : 0) > MAX_FILES) throw new Error('Hermes zpracuje nejvýše 20 souborů v jednom porovnání.');
  const preparedOffers = await Promise.all(args.offers.map(async (offer, index) => ({ offer, source: await secureSource(args.rootPath, offer.path), supplierId: `offer_${index + 1}` })));
  const preparedReference = args.reference ? await secureSource(args.rootPath, args.reference.path) : null;
  const totalBytes = preparedOffers.reduce((sum, entry) => sum + entry.source.buffer.length, preparedReference?.buffer.length || 0);
  if (totalBytes > MAX_TOTAL_BYTES) throw new Error('Celková velikost podkladů překračuje limit 100 MB.');
  const metadata = preparedOffers.map(({ offer, supplierId }) => ({ supplierId, supplierName: offer.supplierName, round: String(offer.round), localScore: null }));
  const expected = new Map(metadata.map((entry) => [entry.supplierId, { name: entry.supplierName, round: entry.round }]));
  const form = new FormData();
  form.append('schemaVersion', '1');
  form.append('requestId', args.requestId);
  form.append('instructionProfile', 'tender-analysis');
  form.append('offerMetadata', JSON.stringify(metadata));
  if (preparedReference) form.append('referenceFile', new Blob([preparedReference.buffer], { type: MIME_BY_EXTENSION[path.extname(preparedReference.realPath).toLowerCase()] }), path.basename(preparedReference.realPath));
  preparedOffers.forEach(({ source }) => form.append('offerFiles', new Blob([source.buffer], { type: MIME_BY_EXTENSION[path.extname(source.realPath).toLowerCase()] }), path.basename(source.realPath)));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(resolveEndpoint(args.baseUrl), {
      method: 'POST',
      headers: { authorization: `Bearer ${args.secret.trim()}`, 'x-request-id': args.requestId, 'idempotency-key': args.requestId },
      body: form,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Zpracování v Hermes překročilo časový limit 120 sekund.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const responseText = await readResponseTextLimited(response);
  if (!response.ok) throw new Error(`Hermes API vrátilo HTTP ${response.status}.`);
  let parsed: unknown;
  try { parsed = JSON.parse(responseText); } catch { throw new Error('Hermes API nevrátilo platný JSON.'); }
  const payload = validateResponse(parsed, args.requestId, expected);
  const references = new Map(payload.referenceItems.map((item) => [item.referenceItemId, item]));
  let referenceWorkbookPath: string | undefined;
  if (args.reference && payload.referenceItems.length) {
    const persisted = await persistBidComparisonNormalization({
      rootPath: args.rootPath,
      sourcePath: args.reference.path,
      supplierName: 'Základní poptávka',
      purpose: 'reference',
      items: payload.referenceItems.map((item): BidComparisonNormalizedItem => ({ pc: item.referenceItemId, kod: item.referenceItemId, popis: boundedText(item.description), mj: item.unit ? boundedText(item.unit, 80) : null, mnozstvi: item.quantity, jcena: null, celkem: null, confidence: item.uncertainty ? 0.6 : 1, reviewRequired: Boolean(item.uncertainty) })),
    });
    referenceWorkbookPath = persisted.workbookPath;
  }
  const normalizedOffers: HermesNormalizedOffer[] = [];
  for (const prepared of preparedOffers) {
    const items: BidComparisonNormalizedItem[] = [];
    for (const row of payload.matrix) {
      const match = row.offers.find((offer) => offer.supplierId === prepared.supplierId);
      if (!match) continue;
      const reference = references.get(row.referenceItemId);
      items.push({
        pc: row.referenceItemId,
        kod: row.referenceItemId,
        popis: boundedText(match.offerItemDescription || reference?.description || row.referenceItemId),
        mj: reference?.unit ? boundedText(reference.unit, 80) : null,
        mnozstvi: match.quantity ?? reference?.quantity ?? null,
        jcena: match.unitPrice,
        celkem: match.totalPrice,
        confidence: match.matchStatus === 'matched' && !match.uncertainty ? 1 : match.matchStatus === 'uncertain' ? 0.6 : 0,
        reviewRequired: match.matchStatus !== 'matched' || Boolean(match.uncertainty) || (match.unitPrice == null && match.totalPrice == null),
      });
    }
    const warnings = payload.findings.filter((finding) => finding.supplierId === prepared.supplierId).map((finding) => boundedText(finding.message, 500));
    const persisted = await persistBidComparisonNormalization({ rootPath: args.rootPath, sourcePath: prepared.offer.path, supplierName: prepared.offer.supplierName, purpose: 'offer', items, warnings });
    normalizedOffers.push({ supplierName: prepared.offer.supplierName, round: prepared.offer.round, variant: prepared.offer.variant, workbookPath: persisted.workbookPath, result: persisted.result });
  }
  return {
    offers: normalizedOffers,
    referenceWorkbookPath,
    recommendation: {
      summary: boundedText(payload.summary, 4_000),
      recommendedSupplier: null,
      nextSteps: payload.recommendedChecks.map((item) => boundedText(item, 500)).filter(Boolean).slice(0, 50),
      risks: payload.risks.map((risk) => ({ severity: risk.severity, supplierName: risk.relatedSupplierIds.map((id) => expected.get(id)?.name).filter(Boolean).join(', ') || null, title: 'Kontrola nabídky', detail: boundedText(risk.message, 1_000) })).slice(0, 100),
    },
  };
};

export const testBidComparisonHermesConnection = async (
  config: BidComparisonAgentConfig,
  secret: string,
): Promise<BidComparisonAgentTestResult> => {
  let endpoint: string | null = null;
  const requestId = crypto.randomUUID();
  try {
    if (!config.enabled) throw new Error('Agentní porovnání je vypnuté.');
    if (!secret.trim()) throw new Error('Chybí bezpečně uložený API token pro Hermes agenta.');
    endpoint = resolveEndpoint(config.baseUrl);
    const metadata = [{ supplierId: 'connection_test', supplierName: 'Test spojení', round: '0', localScore: null }];
    const form = new FormData();
    form.append('schemaVersion', '1');
    form.append('requestId', requestId);
    form.append('instructionProfile', 'tender-analysis');
    form.append('offerMetadata', JSON.stringify(metadata));
    form.append('offerFiles', new Blob(['description,quantity,unitPrice,totalPrice\nTest položka,1,1,1\n'], { type: 'text/csv' }), 'connection-test.csv');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), resolveTimeout(config.timeoutMs));
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret.trim()}`,
          'x-request-id': requestId,
          'idempotency-key': requestId,
        },
        body: form,
        signal: controller.signal,
      });
      const responseText = await readResponseTextLimited(response);
      if (!response.ok) throw new Error(`Hermes API vrátilo HTTP ${response.status}.`);
      let parsed: unknown;
      try { parsed = JSON.parse(responseText); } catch { throw new Error('Hermes API nevrátilo platný JSON.'); }
      validateResponse(parsed, requestId, new Map([['connection_test', { name: 'Test spojení', round: '0' }]]));
      return { success: true, endpoint, status: response.status, error: null };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('Hermes agent neodpověděl v nastaveném timeoutu.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return { success: false, endpoint, status: null, error: error instanceof Error ? error.message : String(error) };
  }
};
