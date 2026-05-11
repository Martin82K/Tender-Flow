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

const splitCsvEnv = (name, fallback = '') =>
  (process.env[name] || fallback)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

const splitScopesEnv = (name, fallback = '') =>
  (process.env[name] || fallback)
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);

export const getAllowedClientIds = () =>
  (process.env.MCP_ALLOWED_CLIENT_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

export const getRequiredMcpScopes = () =>
  splitScopesEnv('MCP_REQUIRED_SCOPES', 'openid email profile');

export const getAllowedAudiences = (expectedResource) =>
  splitCsvEnv('MCP_ALLOWED_AUDIENCES', `authenticated,${expectedResource || ''}`);

const getClaimValues = (value) => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value == null) return [];
  return [String(value)].filter(Boolean);
};

const getResourceValues = (payload) => [
  ...getClaimValues(payload.resource),
  ...getClaimValues(payload.resources),
  ...getClaimValues(payload.aud).filter((value) => value.startsWith('http://') || value.startsWith('https://')),
];

export const isMcpProductionRuntime = () =>
  process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

export const validateMcpTokenClaims = (payload, options = {}) => {
  const expectedResource = options.expectedResource || '';
  const userId = String(payload.sub || payload.user_id || '').trim();
  const clientId = String(payload.client_id || payload.azp || '').trim();
  if (!userId) throw new Error('OAuth token does not contain a user id.');
  if (!clientId) throw new Error('OAuth token does not contain client_id. Use Supabase OAuth 2.1 token, not a regular app session token.');

  const allowedClientIds = getAllowedClientIds();
  if (allowedClientIds.length === 0 && isMcpProductionRuntime()) {
    throw new Error('MCP_ALLOWED_CLIENT_IDS must be configured in production.');
  }
  if (allowedClientIds.length > 0 && !allowedClientIds.includes(clientId)) {
    throw new Error('OAuth client is not allowed for Tender Flow MCP.');
  }

  const audiences = getClaimValues(payload.aud);
  const allowedAudiences = getAllowedAudiences(expectedResource);
  if (audiences.length === 0 || !audiences.some((audience) => allowedAudiences.includes(audience))) {
    throw new Error('OAuth token audience is not allowed for Tender Flow MCP.');
  }

  if (expectedResource) {
    const resources = getResourceValues(payload);
    if (!resources.includes(expectedResource)) {
      throw new Error('OAuth token resource does not match Tender Flow MCP.');
    }
  }

  const scopes = parseScopes(payload);
  const requiredScopes = getRequiredMcpScopes();
  const missingScopes = requiredScopes.filter((scope) => !scopes.includes(scope));
  if (missingScopes.length > 0) {
    throw new Error(`OAuth token is missing required MCP scopes: ${missingScopes.join(', ')}.`);
  }

  return { userId, clientId, scopes };
};

export const verifyMcpBearerToken = async (authorizationHeader, options = {}) => {
  const match = String(authorizationHeader || '').match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new Error('Missing bearer token.');
  }

  const token = match[1].trim();
  const issuer = getSupabaseAuthIssuer();
  const { payload } = await jwtVerify(token, getJwks(issuer), { issuer });
  const claims = validateMcpTokenClaims(payload, options);

  return {
    token,
    userId: claims.userId,
    clientId: claims.clientId,
    scopes: claims.scopes,
    expiresAt: typeof payload.exp === 'number' ? payload.exp : undefined,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    payload,
  };
};
