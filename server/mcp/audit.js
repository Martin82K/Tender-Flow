export const redactForAudit = (value) => {
  if (value == null) return value;
  const text = JSON.stringify(value);
  if (text.length <= 4000) return value;
  return { redacted: true, reason: 'payload_too_large', length: text.length };
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
