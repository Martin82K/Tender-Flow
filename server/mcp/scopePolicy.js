export const MCP_OAUTH_SCOPES = Object.freeze({
  identity: 'openid',
  email: 'email',
  profile: 'profile',
});

export const MCP_PERMISSIONS = Object.freeze({
  read: 'tenderflow.read',
  contactsRead: 'tenderflow.contacts.read',
  write: 'tenderflow.write',
});

const READ_PERMISSIONS = Object.freeze([MCP_PERMISSIONS.read]);
const CONTACT_PERMISSIONS = Object.freeze([MCP_PERMISSIONS.read, MCP_PERMISSIONS.contactsRead]);
const WRITE_PERMISSIONS = Object.freeze([MCP_PERMISSIONS.read, MCP_PERMISSIONS.write]);

const TOOL_POLICIES = Object.freeze({
  search: { requiredPermissions: READ_PERMISSIONS, riskLevel: 'low' },
  fetch: { requiredPermissions: READ_PERMISSIONS, riskLevel: 'low' },
  tf_list_projects: { requiredPermissions: READ_PERMISSIONS, riskLevel: 'low' },
  tf_get_project_summary: { requiredPermissions: READ_PERMISSIONS, riskLevel: 'low' },
  tf_get_project_detail: { requiredPermissions: CONTACT_PERMISSIONS, riskLevel: 'low' },
  tf_list_tenders: { requiredPermissions: READ_PERMISSIONS, riskLevel: 'low' },
  tf_list_bids: { requiredPermissions: CONTACT_PERMISSIONS, riskLevel: 'low' },
  tf_list_winners: { requiredPermissions: CONTACT_PERMISSIONS, riskLevel: 'low' },
  tf_list_contracts: { requiredPermissions: READ_PERMISSIONS, riskLevel: 'low' },
  tf_get_contract_overview: { requiredPermissions: READ_PERMISSIONS, riskLevel: 'low' },
  tf_list_tender_plan: { requiredPermissions: READ_PERMISSIONS, riskLevel: 'low' },
  tf_list_contacts: { requiredPermissions: CONTACT_PERMISSIONS, riskLevel: 'low' },
  tf_list_upcoming_deadlines: { requiredPermissions: READ_PERMISSIONS, riskLevel: 'low' },
  tf_list_tasks: { requiredPermissions: READ_PERMISSIONS, riskLevel: 'low' },
  tf_prepare_change: { requiredPermissions: WRITE_PERMISSIONS, riskLevel: 'medium' },
  tf_confirm_change: { requiredPermissions: WRITE_PERMISSIONS, riskLevel: 'high' },
  tf_execute_change: { requiredPermissions: WRITE_PERMISSIONS, riskLevel: 'high' },
});

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
