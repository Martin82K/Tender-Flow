import { createRemoteJWKSet, jwtVerify } from 'jose';

const getEnv = (name, fallbackName) =>
  process.env[name] || (fallbackName ? process.env[fallbackName] : '') || '';

export const getSupabaseUrl = () => {
  const value = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/, '');
  if (!value) throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL.');
  return value;
};

export const getSupabaseAnonKey = () => {
  const value = getEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!value) throw new Error('Missing SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.');
  return value;
};

export const getSupabaseAuthIssuer = () => `${getSupabaseUrl()}/auth/v1`;

const jwksByIssuer = new Map();

const getJwks = (issuer) => {
  const cached = jwksByIssuer.get(issuer);
  if (cached) return cached;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  jwksByIssuer.set(issuer, jwks);
  return jwks;
};

const parseScopes = (payload) => {
  const raw = payload.scope || payload.scp || '';
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return String(raw)
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
};

const getAllowedClientIds = () =>
  (process.env.MCP_ALLOWED_CLIENT_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

export const verifyMcpBearerToken = async (authorizationHeader) => {
  const match = String(authorizationHeader || '').match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new Error('Missing bearer token.');
  }

  const token = match[1].trim();
  const issuer = getSupabaseAuthIssuer();
  const { payload } = await jwtVerify(token, getJwks(issuer), { issuer });

  const userId = String(payload.sub || payload.user_id || '').trim();
  const clientId = String(payload.client_id || '').trim();
  if (!userId) throw new Error('OAuth token does not contain a user id.');
  if (!clientId) throw new Error('OAuth token does not contain client_id. Use Supabase OAuth 2.1 token, not a regular app session token.');

  const allowedClientIds = getAllowedClientIds();
  if (allowedClientIds.length > 0 && !allowedClientIds.includes(clientId)) {
    throw new Error('OAuth client is not allowed for Tender Flow MCP.');
  }

  return {
    token,
    userId,
    clientId,
    scopes: parseScopes(payload),
    expiresAt: typeof payload.exp === 'number' ? payload.exp : undefined,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    payload,
  };
};
