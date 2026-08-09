const VALID_RISK_LEVELS = new Set(['low', 'medium', 'high']);

const rateLimitUnavailable = () => new Error('Rate limit service is unavailable. Retry later.');

export const checkMcpRateLimit = async (
  supabase,
  auth,
  toolName,
  riskLevel = 'low',
) => {
  if (!VALID_RISK_LEVELS.has(riskLevel)) throw new Error('Invalid MCP risk level.');

  let response;
  try {
    response = await supabase.rpc('consume_mcp_rate_limit', {
      p_client_id: auth.clientId,
      p_risk_level: riskLevel,
    });
  } catch {
    throw rateLimitUnavailable();
  }

  if (response?.error || typeof response?.data?.allowed !== 'boolean') {
    throw rateLimitUnavailable();
  }

  if (!response.data.allowed) {
    const retryAfterSeconds = Math.max(
      1,
      Number(response.data.retry_after_seconds) || 1,
    );
    const error = new Error(
      `Rate limit exceeded for ${toolName}. Retry after ${retryAfterSeconds}s.`,
    );
    error.retryAfterSeconds = retryAfterSeconds;
    throw error;
  }

  return response.data;
};

// Kept as a compatibility no-op for tests and downstream imports. The
// authoritative counters now live in PostgreSQL and have no process state.
export const resetMcpRateLimitsForTests = () => undefined;
