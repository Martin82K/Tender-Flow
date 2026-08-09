import { MCP_PERMISSIONS } from './scopePolicy.js';

const KNOWN_PERMISSIONS = new Set(Object.values(MCP_PERMISSIONS));

const getEnv = (name, fallbackName) =>
  process.env[name] || (fallbackName ? process.env[fallbackName] : '') || '';

const getPermissionServiceConfig = () => {
  const supabaseUrl = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/, '');
  const anonKey = getEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    throw new Error('MCP permission service is not configured.');
  }
  return { supabaseUrl, anonKey };
};

export const resolveMcpPermissions = async ({ token, clientId }) => {
  const accessToken = String(token || '').trim();
  const normalizedClientId = String(clientId || '').trim();
  if (!accessToken || !normalizedClientId) {
    throw new Error('MCP permission resolution requires token and client id.');
  }

  const { supabaseUrl, anonKey } = getPermissionServiceConfig();
  let response;
  try {
    response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_my_mcp_permissions`, {
      method: 'POST',
      signal: AbortSignal.timeout(5_000),
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id_input: normalizedClientId }),
    });
  } catch {
    throw new Error('Unable to resolve MCP permissions.');
  }

  if (!response.ok) {
    throw new Error('Unable to resolve MCP permissions.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Permission service returned an invalid response.');
  }
  if (!Array.isArray(payload)) {
    throw new Error('Permission service returned an invalid response.');
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
