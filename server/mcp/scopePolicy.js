import { MCP_PERMISSION_IDS, MCP_TOOL_CATALOG } from '../../shared/mcp/toolCatalog.js';

export const MCP_OAUTH_SCOPES = Object.freeze({
  identity: 'openid',
  email: 'email',
  profile: 'profile',
});

export const MCP_PERMISSIONS = Object.freeze({
  ...MCP_PERMISSION_IDS,
});

const TOOL_POLICIES = Object.freeze(Object.fromEntries(
  MCP_TOOL_CATALOG.map(({ name, requiredPermissions, riskLevel }) => [
    name,
    { requiredPermissions, riskLevel },
  ]),
));

export const getMcpToolPolicy = (toolName) => {
  const policy = TOOL_POLICIES[toolName];
  if (!policy) throw new Error(`MCP tool policy is missing for ${toolName}.`);
  return policy;
};

export const hasMcpPermissions = (grantedPermissions = [], requiredPermissions = []) => {
  const granted = new Set(grantedPermissions.map(String));
  return requiredPermissions.every((permission) => granted.has(permission));
};

export const assertMcpOAuthScopes = (auth, requiredScopes) => {
  const grantedScopes = Array.isArray(auth?.oauthScopes) ? auth.oauthScopes : [];
  const missing = requiredScopes.filter((scope) => !grantedScopes.includes(scope));
  if (missing.length > 0) {
    throw new Error(`MCP OAuth token is missing required scopes: ${missing.join(', ')}.`);
  }
};

export const assertMcpPermissions = (auth, requiredPermissions) => {
  const grantedPermissions = Array.isArray(auth?.permissions) ? auth.permissions : [];
  const missing = requiredPermissions.filter((permission) => !grantedPermissions.includes(permission));
  if (missing.length > 0) {
    throw new Error(`MCP client is missing required Tender Flow permissions: ${missing.join(', ')}.`);
  }
};

export const getSupportedMcpOAuthScopes = () => [
  MCP_OAUTH_SCOPES.identity,
  MCP_OAUTH_SCOPES.email,
  MCP_OAUTH_SCOPES.profile,
];
