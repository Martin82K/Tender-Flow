import { logMcpAuditEvent, summarizeResultForAudit } from '../audit.js';
import { checkMcpRateLimit } from '../rateLimit.js';
import {
  assertMcpPermissions,
  getMcpToolPolicy,
  hasMcpPermissions,
} from '../scopePolicy.js';

const WRITE_AUDIT_ACTIONS = new Set([
  'link_outlook_message',
  'prepare_write',
  'confirm_write',
  'execute_write',
]);

const textJson = (value, isError = false) => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  structuredContent: value,
  isError,
});

export const createMcpToolRuntime = ({ server, auth, supabase }) => {
  const withAudit = (toolName, action, handler, riskLevel = 'low') => async (args) => {
    const policy = getMcpToolPolicy(toolName);
    const effectiveRiskLevel = riskLevel === 'low' ? policy.riskLevel : riskLevel;
    const requiresPreAudit = WRITE_AUDIT_ACTIONS.has(action);

    try {
      assertMcpPermissions(auth, policy.requiredPermissions);
      await checkMcpRateLimit(supabase, auth, toolName, effectiveRiskLevel);
      if (requiresPreAudit) {
        await logMcpAuditEvent(supabase, {
          userId: auth.userId,
          clientId: auth.clientId,
          toolName,
          action: `${action}_attempt`,
          riskLevel: effectiveRiskLevel,
          success: true,
          requestSummary: args,
          resultSummary: { status: 'attempted' },
        }, { required: true });
      }

      const result = await handler(args);
      await logMcpAuditEvent(supabase, {
        userId: auth.userId,
        clientId: auth.clientId,
        toolName,
        action,
        riskLevel: effectiveRiskLevel,
        success: true,
        requestSummary: args,
        resultSummary: summarizeResultForAudit(result),
      });
      return textJson(result);
    } catch (error) {
      await logMcpAuditEvent(supabase, {
        userId: auth.userId,
        clientId: auth.clientId,
        toolName,
        action,
        riskLevel: effectiveRiskLevel,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        requestSummary: args,
      });
      return textJson({ ok: false, error: error instanceof Error ? error.message : String(error) }, true);
    }
  };

  return {
    register(toolName, config, handler, options = {}) {
      const policy = getMcpToolPolicy(toolName);
      if (!hasMcpPermissions(auth.permissions, policy.requiredPermissions)) return;

      const securitySchemes = [{ type: 'oauth2', scopes: ['openid'] }];
      server.registerTool(toolName, {
        ...config,
        securitySchemes,
        _meta: {
          ...config._meta,
          securitySchemes,
        },
      }, withAudit(
        toolName,
        options.action || 'read',
        handler,
        options.riskLevel || 'low',
      ));
    },
  };
};
