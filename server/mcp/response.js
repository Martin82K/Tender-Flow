import { getRequiredMcpScopes } from './supabaseAuth.js';

export const jsonResponse = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });

export const getBaseUrl = (request) => {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    return `${forwardedProto || 'https'}://${forwardedHost}`;
  }

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
};

export const buildMcpResourceMetadata = (request) => {
  const baseUrl = getBaseUrl(request);
  const mcpResource = `${baseUrl}/api/mcp`;
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const authServer = supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/auth/v1` : undefined;

  return {
    resource: mcpResource,
    authorization_servers: authServer ? [authServer] : [],
    bearer_methods_supported: ['header'],
    scopes_supported: getRequiredMcpScopes(),
    resource_documentation: `${baseUrl}/app/settings?tab=tools`,
  };
};

export const unauthorizedMcpResponse = (request, message = 'Authorization required') => {
  const baseUrl = getBaseUrl(request);
  return jsonResponse(
    401,
    { error: 'unauthorized', message },
    {
      'www-authenticate': `Bearer resource_metadata="${baseUrl}/api/mcp-resource"`,
    },
  );
};
