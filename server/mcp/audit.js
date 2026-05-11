const SENSITIVE_KEY_PATTERN = /(authorization|cookie|secret|token|executeToken|execute_token|password|apikey|api_key|access[_-]?key|refresh[_-]?token|idempotencyKey|idempotency_key)/i;
const MAX_STRING_LENGTH = 240;
const MAX_OBJECT_KEYS = 16;
const MAX_ARRAY_ITEMS = 5;
const MAX_SERIALIZED_LENGTH = 4000;

const truncateString = (value) => {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated ${value.length - MAX_STRING_LENGTH} chars]`;
};

const summarizeScalar = (value) => {
  if (typeof value === 'string') return truncateString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return value == null ? value : String(value);
};

const summarizeArray = (value, depth) => ({
  type: 'array',
  count: value.length,
  sample: value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactForAudit(item, depth + 1)),
});

const summarizeObject = (value, depth) => {
  const entries = Object.entries(value);
  const summarized = {};
  for (const [key, item] of entries.slice(0, MAX_OBJECT_KEYS)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      summarized[key] = { redacted: true, reason: 'sensitive_key' };
      continue;
    }
    summarized[key] = redactForAudit(item, depth + 1);
  }
  if (entries.length > MAX_OBJECT_KEYS) {
    summarized._truncatedKeys = entries.length - MAX_OBJECT_KEYS;
  }
  return summarized;
};

export const redactForAudit = (value, depth = 0) => {
  if (value == null || typeof value !== 'object') return summarizeScalar(value);
  if (depth >= 4) return { redacted: true, reason: 'max_depth' };

  const summarized = Array.isArray(value)
    ? summarizeArray(value, depth)
    : summarizeObject(value, depth);
  const text = JSON.stringify(summarized);
  if (text.length <= MAX_SERIALIZED_LENGTH) return summarized;
  return { redacted: true, reason: 'payload_too_large', length: text.length };
};

export const summarizeResultForAudit = (result) => {
  const ok = typeof result?.ok === 'boolean' ? result.ok : undefined;
  const error = typeof result?.error === 'string' ? result.error : undefined;
  const data = result?.data;
  if (data && typeof data === 'object') {
    return redactForAudit({
      ok,
      error,
      status: data.status,
      proposalId: data.proposalId,
      entityType: data.task ? 'task' : undefined,
      entityId: data.task?.id,
      resultKeys: Object.keys(data).slice(0, MAX_OBJECT_KEYS),
    });
  }
  return redactForAudit({ ok, error, data });
};

export const logMcpAuditEvent = async (supabase, event) => {
  try {
    await supabase.from('mcp_audit_events').insert({
      user_id: event.userId,
      client_id: event.clientId,
      tool_name: event.toolName,
      action: event.action,
      entity_type: event.entityType ?? null,
      entity_id: event.entityId ?? null,
      risk_level: event.riskLevel ?? 'low',
      success: event.success,
      error_message: event.errorMessage ?? null,
      request_summary: redactForAudit(event.requestSummary ?? null),
      result_summary: redactForAudit(event.resultSummary ?? null),
    });
  } catch {
    // Audit logging must not break read-only MCP calls. Security-sensitive
    // write calls log again after execution and surface their own failure.
  }
};
