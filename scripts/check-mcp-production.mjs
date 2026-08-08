const baseUrl = String(process.env.MCP_CANARY_BASE_URL || 'https://www.tenderflow.cz').replace(/\/$/, '');
const expectedResource = `${baseUrl}/api/mcp`;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const readJson = async (response, label) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} did not return JSON (HTTP ${response.status}).`);
  }
};

const metadataResponse = await fetch(`${baseUrl}/api/mcp-resource`, {
  headers: { accept: 'application/json' },
  redirect: 'error',
});
assert(metadataResponse.ok, `Protected-resource metadata failed with HTTP ${metadataResponse.status}.`);
const metadata = await readJson(metadataResponse, 'Protected-resource metadata');
assert(metadata.resource === expectedResource, `Unexpected MCP resource: ${metadata.resource || '<missing>'}.`);
assert(Array.isArray(metadata.authorization_servers) && metadata.authorization_servers.length === 1,
  'Exactly one OAuth authorization server must be advertised.');
assert(['openid', 'email', 'profile'].every((scope) => metadata.scopes_supported?.includes(scope)),
  'Protected-resource metadata is missing a required standard OAuth scope.');

const authorizationServer = new URL(metadata.authorization_servers[0]);
const discoveryUrl = new URL(
  `/.well-known/oauth-authorization-server${authorizationServer.pathname.replace(/\/$/, '')}`,
  authorizationServer.origin,
);
const discoveryResponse = await fetch(discoveryUrl, {
  headers: { accept: 'application/json' },
  redirect: 'error',
});
assert(discoveryResponse.ok, `OAuth discovery failed with HTTP ${discoveryResponse.status}.`);
const discovery = await readJson(discoveryResponse, 'OAuth discovery');
assert(discovery.issuer === authorizationServer.href.replace(/\/$/, ''), 'OAuth issuer does not match advertised server.');
assert(discovery.response_types_supported?.includes('code'), 'OAuth authorization code flow is not advertised.');
assert(discovery.code_challenge_methods_supported?.includes('S256'), 'OAuth PKCE S256 is not advertised.');
assert(typeof discovery.jwks_uri === 'string' && discovery.jwks_uri.startsWith(`${authorizationServer.origin}/`),
  'OAuth JWKS URI is missing or cross-origin.');
assert(discovery.id_token_signing_alg_values_supported?.some((algorithm) => ['RS256', 'ES256'].includes(algorithm)),
  'OAuth discovery does not advertise an asymmetric ID-token signing algorithm.');

const unauthorizedResponse = await fetch(expectedResource, {
  method: 'POST',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 'production-canary',
    method: 'server/discover',
    params: {},
  }),
  redirect: 'error',
});
assert(unauthorizedResponse.status === 401, `Unauthenticated MCP request returned HTTP ${unauthorizedResponse.status}.`);
assert(
  unauthorizedResponse.headers.get('www-authenticate') === `Bearer resource_metadata="${baseUrl}/api/mcp-resource"`,
  'MCP 401 challenge points to unexpected protected-resource metadata.',
);
assert(unauthorizedResponse.headers.get('cache-control')?.includes('no-store'),
  'MCP 401 response is not explicitly marked no-store.');

console.log(JSON.stringify({
  ok: true,
  resource: metadata.resource,
  authorizationServer: metadata.authorization_servers[0],
  scopes: metadata.scopes_supported,
  oauth: {
    authorizationCode: true,
    pkceS256: true,
    asymmetricSigningAdvertised: true,
  },
  unauthenticatedChallenge: {
    status: unauthorizedResponse.status,
    cacheControl: unauthorizedResponse.headers.get('cache-control'),
  },
}, null, 2));
