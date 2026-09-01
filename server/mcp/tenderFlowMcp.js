import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { createUserSupabaseClient } from './data.js';
import { getBaseUrl, unauthorizedMcpResponse, jsonResponse } from './response.js';
import { MCP_PERMISSIONS, hasMcpPermissions } from './scopePolicy.js';
import { verifyMcpBearerToken } from './supabaseAuth.js';
import { isMcpPermissionServiceUnavailableError } from './permissionGrants.js';
import { KANBAN_WRITE_INSTRUCTIONS } from './modules/changes.js';
import { registerTenderFlowMcpModules } from './modules/index.js';

export {
  assertProjectVisible,
  createProposal,
  executeProposal,
  isExecutionConfirmed,
} from './modules/changes.js';

export const createTenderFlowMcpServer = (auth, options = {}) => {
  const includeWriteTools = options.includeWriteTools !== false;
  const canUseWriteTools = includeWriteTools && hasMcpPermissions(auth.permissions, [MCP_PERMISSIONS.write]);
  const supabase = createUserSupabaseClient(auth.token);
  const server = new McpServer(
    {
      name: 'Tender Flow MCP',
      version: '0.6.0',
    },
    {
      instructions: canUseWriteTools ? KANBAN_WRITE_INSTRUCTIONS : undefined,
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false },
      },
    },
  );

  registerTenderFlowMcpModules({
    server,
    auth,
    supabase,
    includeWriteTools,
  });

  return server;
};
const authFromRequestContext = (context) => {
  const authInfo = context.authInfo;
  const userId = typeof authInfo?.extra?.userId === 'string'
    ? authInfo.extra.userId
    : '';

  if (!authInfo?.token || !authInfo.clientId || !userId) {
    throw new Error('Authenticated MCP request context is incomplete.');
  }

  return {
    token: authInfo.token,
    userId,
    clientId: authInfo.clientId,
    oauthScopes: authInfo.scopes,
    permissions: Array.isArray(authInfo.extra?.permissions)
      ? authInfo.extra.permissions.filter((permission) => typeof permission === 'string')
      : [],
    expiresAt: authInfo.expiresAt,
    email: typeof authInfo.extra?.email === 'string' ? authInfo.extra.email : undefined,
  };
};

const tenderFlowMcpHandler = createMcpHandler(
  (context) => createTenderFlowMcpServer(authFromRequestContext(context)),
  {
    legacy: 'stateless',
  },
);

export const handleAuthorizedMcpRequest = async (request, auth) => {
  const response = await tenderFlowMcpHandler.fetch(request, {
    authInfo: {
      token: auth.token,
      clientId: auth.clientId,
      scopes: auth.oauthScopes,
      expiresAt: auth.expiresAt,
      extra: { userId: auth.userId, email: auth.email, permissions: auth.permissions },
    },
  });
  response.headers.set('cache-control', 'private, no-store');
  return response;
};

const allowedMcpOrigins = () =>
  (process.env.MCP_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

export const validateMcpRequestOrigin = (request) => {
  const origin = request.headers.get('origin');
  if (!origin) return undefined;

  let normalizedOrigin;
  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error('Origin must be an absolute HTTP(S) origin.');
    }
    normalizedOrigin = parsed.origin;
  } catch {
    throw new Error('MCP request origin is invalid.');
  }

  const configuredOrigins = allowedMcpOrigins();
  const developmentFallback = process.env.NODE_ENV === 'production'
    ? []
    : [new URL(getBaseUrl(request)).origin];
  if (![...configuredOrigins, ...developmentFallback].includes(normalizedOrigin)) {
    throw new Error('MCP request origin is not allowed.');
  }

  return normalizedOrigin;
};

const withMcpCors = (response, origin) => {
  response.headers.set('cache-control', 'private, no-store');
  if (origin) {
    response.headers.set('access-control-allow-origin', origin);
    response.headers.append('vary', 'Origin');
  }
  response.headers.set('access-control-expose-headers', 'mcp-protocol-version,www-authenticate');
  return response;
};

export const mcpAuthenticationFailureResponse = (request, error) => {
  if (isMcpPermissionServiceUnavailableError(error)) {
    return jsonResponse(503, {
      error: 'mcp_auth_service_unavailable',
      message: 'MCP authorization service is temporarily unavailable.',
      status: 503,
    });
  }
  return unauthorizedMcpResponse(
    request,
    error instanceof Error ? error.message : String(error),
  );
};

const getMcpAuthenticationFailureCode = (error) => {
  if (isMcpPermissionServiceUnavailableError(error)) return 'permission_service_unavailable';
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'Missing bearer token.') return 'missing_bearer';
  if (message.includes('database role')) return 'invalid_role';
  if (message.includes('client_id') || message.includes('client is not allowed')) return 'invalid_client';
  if (message.includes('audience')) return 'invalid_audience';
  if (message.includes('resource')) return 'invalid_resource';
  if (message.includes('scope')) return 'invalid_scope';
  return 'invalid_token';
};

const logMcpAuthenticationFailure = (request, error) => {
  const url = new URL(request.url);
  console.warn({
    event: 'mcp_auth_rejected',
    code: getMcpAuthenticationFailureCode(error),
    method: request.method,
    path: url.pathname,
  });
};

export const handleMcpWebRequest = async (request) => {
  let origin;
  try {
    origin = validateMcpRequestOrigin(request);
  } catch (error) {
    return jsonResponse(403, {
      error: 'forbidden_origin',
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (request.method === 'OPTIONS') {
    return withMcpCors(new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-methods': 'POST,OPTIONS',
        'access-control-allow-headers': 'authorization,content-type,mcp-protocol-version,mcp-method,mcp-name',
      },
    }), origin);
  }

  let auth;
  try {
    auth = await verifyMcpBearerToken(request.headers.get('authorization'), {
      expectedResource: `${getBaseUrl(request)}/api/mcp`,
    });
  } catch (error) {
    if (request.headers.has('authorization')) {
      logMcpAuthenticationFailure(request, error);
    }
    return withMcpCors(
      mcpAuthenticationFailureResponse(request, error),
      origin,
    );
  }

  try {
    return withMcpCors(await handleAuthorizedMcpRequest(request, auth), origin);
  } catch (error) {
    return withMcpCors(jsonResponse(500, {
      error: 'mcp_server_error',
      message: error instanceof Error ? error.message : String(error),
    }), origin);
  }
};
