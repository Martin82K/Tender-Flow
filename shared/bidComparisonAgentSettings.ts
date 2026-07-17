import type { BidComparisonAgentConfig } from './types/desktop';

export const BID_COMPARISON_AGENT_SETTINGS_KEY = 'bidComparisonAgentSettings:v1';
export const DEFAULT_BID_COMPARISON_AGENT_BASE_URL = 'https://agent.kalmatech.cz';
export const DEFAULT_BID_COMPARISON_AGENT_TIMEOUT_MS = 60_000;

const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 120_000;

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const normalizeTimeout = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_BID_COMPARISON_AGENT_TIMEOUT_MS;
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, Math.floor(parsed)));
};

export const normalizeBidComparisonAgentConfig = (
  value: unknown,
): BidComparisonAgentConfig => {
  const source = value && typeof value === 'object'
    ? (value as Partial<BidComparisonAgentConfig>)
    : {};

  return {
    enabled: source.enabled === true,
    baseUrl: readString(source.baseUrl) || DEFAULT_BID_COMPARISON_AGENT_BASE_URL,
    bearerToken: readString(source.bearerToken),
    timeoutMs: normalizeTimeout(source.timeoutMs),
  };
};

export const parseBidComparisonAgentSettings = (
  rawValue: string | null,
): BidComparisonAgentConfig => {
  if (!rawValue) {
    return normalizeBidComparisonAgentConfig(null);
  }

  try {
    return normalizeBidComparisonAgentConfig(JSON.parse(rawValue));
  } catch {
    return normalizeBidComparisonAgentConfig(null);
  }
};

export const isBidComparisonAgentRunnable = (
  config: BidComparisonAgentConfig,
): boolean =>
  config.enabled &&
  config.baseUrl.trim().length > 0;

export const toRuntimeBidComparisonAgentConfig = (
  config: BidComparisonAgentConfig,
): BidComparisonAgentConfig => {
  const normalized = normalizeBidComparisonAgentConfig(config);
  return {
    ...normalized,
    enabled: isBidComparisonAgentRunnable(normalized),
  };
};
