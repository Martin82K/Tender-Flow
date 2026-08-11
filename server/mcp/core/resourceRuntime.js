import { logMcpAuditEvent } from '../audit.js';
import { checkMcpRateLimit } from '../rateLimit.js';
import { assertMcpOAuthScopes, assertMcpPermissions } from '../scopePolicy.js';

export const resourceJson = (uri, value) => ({
  contents: [{
    uri: uri.href,
    mimeType: 'application/json',
    text: JSON.stringify(value, null, 2),
  }],
});

export const createMcpResourceRuntime = ({ server, auth, supabase }) => ({
  register(resourceName, uri, config, requirements, handler, options = {}) {
    const auditName = options.auditName || resourceName;
    server.registerResource(resourceName, uri, config, async (...args) => {
      const uri = args[0];
      try {
        assertMcpOAuthScopes(auth, requirements.oauthScopes || []);
        assertMcpPermissions(auth, requirements.permissions || []);
        await checkMcpRateLimit(supabase, auth, `resource:${auditName}`, 'low');
        const result = await handler(...args);
        await logMcpAuditEvent(supabase, {
          userId: auth.userId,
          clientId: auth.clientId,
          toolName: `resource:${auditName}`,
          action: 'resource_read',
          riskLevel: 'low',
          success: true,
          requestSummary: { uri: uri.href },
          resultSummary: { ok: true },
        });
        return result;
      } catch (error) {
        await logMcpAuditEvent(supabase, {
          userId: auth.userId,
          clientId: auth.clientId,
          toolName: `resource:${auditName}`,
          action: 'resource_read',
          riskLevel: 'low',
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
          requestSummary: { uri: uri.href },
        });
        throw error;
      }
    });
  },
});
