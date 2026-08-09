import { MCP_PERMISSIONS } from './scopePolicy.js';
import { deriveMcpBackendProof } from './backendProof.js';

const KNOWN_PERMISSIONS = new Set(Object.values(MCP_PERMISSIONS));
const backendProofRegistrations = new Map();

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

export const clearMcpBackendProofRegistrationCache = () => {
  backendProofRegistrations.clear();
};

const registerBackendProof = async ({ supabaseUrl, secretKey, backendProof }) => {
  const cacheKey = `${supabaseUrl}:${backendProof}`;
  const cached = backendProofRegistrations.get(cacheKey);
  if (cached) return cached;

  const registration = (async () => {
    let response;
    try {
      response = await fetch(`${supabaseUrl}/rest/v1/rpc/register_mcp_backend_proof`, {
        method: 'POST',
        signal: AbortSignal.timeout(5_000),
        headers: {
          apikey: secretKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ proof_input: backendProof }),
      });
    } catch {
      throw new McpPermissionServiceUnavailableError();
    }

    if (!response.ok) throw new McpPermissionServiceUnavailableError();
    try {
      if (await response.json() !== true) throw new McpPermissionServiceUnavailableError();
    } catch (error) {
      if (error instanceof McpPermissionServiceUnavailableError) throw error;
      throw new McpPermissionServiceUnavailableError();
    }
  })();

  backendProofRegistrations.set(cacheKey, registration);
  try {
    await registration;
  } catch (error) {
    backendProofRegistrations.delete(cacheKey);
    throw error;
  }
};

export const resolveMcpPermissions = async ({ token, clientId }) => {
  const accessToken = String(token || '').trim();
  const normalizedClientId = String(clientId || '').trim();
  if (!accessToken || !normalizedClientId) {
    throw new Error('MCP permission resolution requires token and client id.');
  }

  const { supabaseUrl, secretKey } = getPermissionServiceConfig();
  const backendProof = deriveMcpBackendProof(secretKey);
  await registerBackendProof({ supabaseUrl, secretKey, backendProof });
  let response;
  try {
    response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_my_mcp_permissions`, {
      method: 'POST',
      signal: AbortSignal.timeout(5_000),
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${accessToken}`,
        'x-tenderflow-mcp-proof': backendProof,
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
