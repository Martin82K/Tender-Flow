const WINDOW_MS = 60_000;
const buckets = new Map();

const limitsByRisk = {
  low: 120,
  medium: 30,
  high: 12,
};

const getLimit = (riskLevel) => limitsByRisk[riskLevel] || limitsByRisk.low;

export const checkMcpRateLimit = (auth, toolName, riskLevel = 'low') => {
  const now = Date.now();
  const key = `${auth.userId}:${auth.clientId}:${toolName}`;
  const current = buckets.get(key);
  const limit = getLimit(riskLevel);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  current.count += 1;
  if (current.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    const error = new Error(`Rate limit exceeded for ${toolName}. Retry after ${retryAfterSeconds}s.`);
    error.retryAfterSeconds = retryAfterSeconds;
    throw error;
  }
};

export const resetMcpRateLimitsForTests = () => {
  buckets.clear();
};
