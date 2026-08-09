import { MCP_PERMISSIONS } from './scopePolicy.js';

const KNOWN_PERMISSIONS = new Set(Object.values(MCP_PERMISSIONS));

export class McpPermissionServiceUnavailableError extends Error {
  constructor() {
    super('Unable to resolve MCP permissions.');
    this.name = 'McpPermissionServiceUnavailableError';
    this.code = 'MCP_PERMISSION_SERVICE_UNAVAILABLE';
  }
}

export const isMcpPermissionServiceUnavailableError = (error) =>
  error instanceof McpPermissionServiceUnavailableError
  || error?.code === 'MCP_PERMISSION_SERVICE_UNAVAILABLE';

const getEnv = (name, fallbackName) =>
  process.env[name] || (fallbackName ? process.env[fallbackName] : '') || '';

const getPermissionServiceConfig = () => {
  const supabaseUrl = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/, '');
  const secretKey = getEnv('SUPABASE_MCP_SECRET_KEY');
  if (!supabaseUrl || !secretKey) {
    throw new McpPermissionServiceUnavailableError();
  }
  if (!secretKey.startsWith('sb_secret_')) {
    throw new McpPermissionServiceUnavailableError();
  }
  return { supabaseUrl, secretKey };
};

export const resolveMcpPermissions = async ({ token, clientId }) => {
  const accessToken = String(token || '').trim();
  const normalizedClientId = String(clientId || '').trim();
  if (!accessToken || !normalizedClientId) {
    throw new Error('MCP permission resolution requires token and client id.');
  }

  const { supabaseUrl, secretKey } = getPermissionServiceConfig();
  let response;
  try {
    response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_my_mcp_permissions`, {
      method: 'POST',
      signal: AbortSignal.timeout(5_000),
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id_input: normalizedClientId }),
    });
  } catch {
    throw new McpPermissionServiceUnavailableError();
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new McpPermissionServiceUnavailableError();
    }
    throw new Error('Unable to resolve MCP permissions.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new McpPermissionServiceUnavailableError();
  }
  if (!Array.isArray(payload)) {
    throw new McpPermissionServiceUnavailableError();
  }

  const permissions = Array.from(new Set(payload.map((permission) => String(permission))));
  const unsupported = permissions.find((permission) => !KNOWN_PERMISSIONS.has(permission));
  if (unsupported) {
    throw new Error('Permission service returned an unsupported permission.');
  }
  if (!permissions.includes(MCP_PERMISSIONS.read)) {
    throw new Error('MCP client is not enabled for read access.');
  }
  return permissions;
};
