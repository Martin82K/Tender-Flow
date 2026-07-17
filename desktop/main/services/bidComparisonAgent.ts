import * as crypto from 'crypto';
import type { BidComparisonAgentConfig, BidComparisonEvaluation, BidComparisonFileConfig } from '../types';
import type {
  BidComparisonAgentRecommendation,
  BidComparisonAgentRisk,
  BidComparisonMatrixItem,
  BuildComparisonResult,
} from './bidComparisonEngine';

export interface BidComparisonAgentPayload {
  version: 2;
  requestId: string;
  source: 'tender-flow';
  mode: 'analysis' | 'connection_test';
  generatedAt: string;
  policy: {
    inputTrust: 'untrusted-business-data';
    numericAuthority: 'tender-flow-local';
    allowedTask: 'explain-and-flag-only';
  };
  tender: {
    projectId: string | null;
    categoryId: string | null;
    folderName: string;
  };
  comparison: {
    pocetPolozek: number;
    suppliers: BuildComparisonResult['suppliers'];
    matrix: BidComparisonMatrixItem[];
    evaluation: BidComparisonEvaluation | null;
    criteria: BidComparisonFileConfig['suppliers'];
  };
}

export interface BidComparisonAgentRequestInput {
  config: BidComparisonAgentConfig;
  projectId: string | null;
  categoryId: string | null;
  tenderFolderName: string;
  pocetPolozek: number;
  suppliers: BuildComparisonResult['suppliers'];
  matrix: BidComparisonMatrixItem[];
  requestId: string;
  evaluation: BidComparisonEvaluation;
  criteria: BidComparisonFileConfig['suppliers'];
}

export interface BidComparisonAgentTestResult {
  success: boolean;
  endpoint: string | null;
  status: number | null;
  error: string | null;
}

const AGENT_ENDPOINT_PATH = '/v1/tender-flow/bid-analysis';
const DEFAULT_AGENT_TIMEOUT_MS = 60_000;
const MIN_AGENT_TIMEOUT_MS = 5_000;
const MAX_AGENT_TIMEOUT_MS = 120_000;
const MAX_TEXT_LENGTH = 6_000;
const MAX_STEP_LENGTH = 1_000;
const MAX_RISK_LENGTH = 1_500;
const MAX_RESPONSE_BYTES = 512 * 1024;
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;

const clampTimeout = (timeoutMs: number | undefined): number => {
  if (!Number.isFinite(timeoutMs)) return DEFAULT_AGENT_TIMEOUT_MS;
  return Math.max(MIN_AGENT_TIMEOUT_MS, Math.min(MAX_AGENT_TIMEOUT_MS, Math.floor(timeoutMs as number)));
};

const sanitizeText = (value: unknown, maxLength: number): string => {
  const text = String(value ?? '').replace(/\r\n/g, '\n').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

const normalizeSeverity = (value: unknown): BidComparisonAgentRisk['severity'] => {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'medium';
};

export const resolveBidComparisonAgentEndpoint = (config: BidComparisonAgentConfig): string => {
  const rawBaseUrl = (config.baseUrl || '').trim();
  if (!rawBaseUrl) {
    throw new Error('Chybí URL Hermes agenta.');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawBaseUrl);
  } catch {
    throw new Error('URL Hermes agenta není platná.');
  }

  const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocal)) {
    throw new Error('Hermes agent musí používat HTTPS URL (HTTP je povoleno jen pro localhost).');
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  if (!normalizedPath.endsWith(AGENT_ENDPOINT_PATH)) {
    parsed.pathname = `${normalizedPath}${AGENT_ENDPOINT_PATH}`.replace(/\/{2,}/g, '/');
  }
  parsed.search = '';
  parsed.hash = '';

  return parsed.toString();
};

const assertUsableAgentConfig = (config: BidComparisonAgentConfig): void => {
  if (!config.enabled) {
    throw new Error('Agentní porovnání je vypnuté.');
  }
};

const createPayload = (
  input: BidComparisonAgentRequestInput,
  mode: BidComparisonAgentPayload['mode'],
): BidComparisonAgentPayload => ({
  version: 2,
  requestId: input.requestId,
  source: 'tender-flow',
  mode,
  generatedAt: new Date().toISOString(),
  policy: {
    inputTrust: 'untrusted-business-data',
    numericAuthority: 'tender-flow-local',
    allowedTask: 'explain-and-flag-only',
  },
  tender: {
    projectId: input.projectId,
    categoryId: input.categoryId,
    folderName: input.tenderFolderName,
  },
  comparison: {
    pocetPolozek: input.pocetPolozek,
    suppliers: input.suppliers,
    matrix: input.matrix,
    evaluation: input.evaluation,
    criteria: input.criteria,
  },
});

const normalizeRisk = (risk: unknown): BidComparisonAgentRisk | null => {
  if (!risk || typeof risk !== 'object') return null;
  const source = risk as Record<string, unknown>;
  const title = sanitizeText(source.title, 240);
  const detail = sanitizeText(source.detail, MAX_RISK_LENGTH);
  if (!title || !detail) return null;

  return {
    severity: normalizeSeverity(source.severity),
    itemKod: source.itemKod == null ? null : sanitizeText(source.itemKod, 120),
    itemPc: source.itemPc == null ? null : sanitizeText(source.itemPc, 120),
    supplierName: source.supplierName == null ? null : sanitizeText(source.supplierName, 240),
    title,
    detail,
  };
};

export const normalizeAgentRecommendation = (raw: unknown): BidComparisonAgentRecommendation => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Hermes agent vrátil neplatnou odpověď.');
  }

  const container = raw as Record<string, unknown>;
  const source = (
    container.recommendation && typeof container.recommendation === 'object'
      ? container.recommendation
      : container
  ) as Record<string, unknown>;

  const summary = sanitizeText(source.summary, MAX_TEXT_LENGTH);
  if (!summary) {
    throw new Error('Hermes agent nevrátil povinné shrnutí.');
  }

  const nextSteps = Array.isArray(source.nextSteps)
    ? source.nextSteps
        .map((step) => sanitizeText(step, MAX_STEP_LENGTH))
        .filter(Boolean)
        .slice(0, 20)
    : [];

  const risks = Array.isArray(source.risks)
    ? source.risks
        .map(normalizeRisk)
        .filter((risk): risk is BidComparisonAgentRisk => risk != null)
        .slice(0, 100)
    : [];

  return {
    summary,
    recommendedSupplier:
      source.recommendedSupplier == null
        ? null
        : sanitizeText(source.recommendedSupplier, 240),
    nextSteps,
    risks,
  };
};

const postToAgent = async (
  config: BidComparisonAgentConfig,
  payload: BidComparisonAgentPayload,
  secret: string,
): Promise<{ status: number; json: unknown }> => {
  assertUsableAgentConfig(config);
  const endpoint = resolveBidComparisonAgentEndpoint(config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), clampTimeout(config.timeoutMs));

  const requestBody = JSON.stringify(payload);
  if (Buffer.byteLength(requestBody, 'utf8') > MAX_REQUEST_BYTES) throw new Error('Data pro Hermes agenta překračují povolený limit.');
  if (!secret.trim()) throw new Error('Chybí bezpečně uložený API token pro Hermes agenta.');
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret.trim()}`,
        'content-type': 'application/json',
        'x-request-id': payload.requestId,
        'idempotency-key': payload.requestId,
      },
      body: requestBody,
      signal: controller.signal,
    });

    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) throw new Error('Hermes agent vrátil příliš velkou odpověď.');
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new Error('Hermes agent vrátil příliš velkou odpověď.');
        }
        chunks.push(value);
      }
    }
    const text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
    if (!response.ok) {
      throw new Error(`Hermes agent vrátil HTTP ${response.status}.`);
    }

    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error('Hermes agent vrátil odpověď, která není platné JSON.');
    }
    if (!json || typeof json !== 'object' || (json as Record<string, unknown>).version !== 2) {
      throw new Error('Hermes agent vrátil nepodporovanou verzi odpovědi.');
    }
    return { status: response.status, json };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Hermes agent neodpověděl v nastaveném timeoutu.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const requestBidComparisonAgentRecommendation = async (
  input: BidComparisonAgentRequestInput,
  secret: string,
): Promise<BidComparisonAgentRecommendation> => {
  const payload = createPayload(input, 'analysis');
  const response = await postToAgent(input.config, payload, secret);
  const recommendation = normalizeAgentRecommendation(response.json);
  const knownSuppliers = new Set(input.evaluation.scores.map((score) => score.supplierName));
  if (recommendation.recommendedSupplier && !knownSuppliers.has(recommendation.recommendedSupplier)) {
    throw new Error('Hermes agent odkázal na neznámého dodavatele.');
  }
  recommendation.risks.forEach((risk) => {
    if (risk.supplierName && !knownSuppliers.has(risk.supplierName)) throw new Error('Hermes agent vrátil riziko pro neznámého dodavatele.');
  });
  return recommendation;
};

export const testBidComparisonAgentConnection = async (
  config: BidComparisonAgentConfig,
  secret: string,
): Promise<BidComparisonAgentTestResult> => {
  let endpoint: string | null = null;
  try {
    endpoint = resolveBidComparisonAgentEndpoint(config);
    const response = await postToAgent(config, {
      version: 2,
      requestId: crypto.randomUUID(),
      source: 'tender-flow',
      mode: 'connection_test',
      generatedAt: new Date().toISOString(),
      policy: {
        inputTrust: 'untrusted-business-data',
        numericAuthority: 'tender-flow-local',
        allowedTask: 'explain-and-flag-only',
      },
      tender: {
        projectId: null,
        categoryId: null,
        folderName: 'connection-test',
      },
      comparison: {
        pocetPolozek: 0,
        suppliers: {},
        matrix: [],
        evaluation: null,
        criteria: {},
      },
    }, secret);

    return {
      success: true,
      endpoint,
      status: response.status,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      endpoint,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
