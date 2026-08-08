export const MCP_SCOPES = Object.freeze({
  identity: 'openid',
  read: 'tenderflow.read',
  contactsRead: 'tenderflow.contacts.read',
  write: 'tenderflow.write',
});

const READ_SCOPES = Object.freeze([MCP_SCOPES.read]);
const CONTACT_SCOPES = Object.freeze([MCP_SCOPES.read, MCP_SCOPES.contactsRead]);
const WRITE_SCOPES = Object.freeze([MCP_SCOPES.read, MCP_SCOPES.write]);

const TOOL_POLICIES = Object.freeze({
  search: { requiredScopes: CONTACT_SCOPES, riskLevel: 'low' },
  fetch: { requiredScopes: CONTACT_SCOPES, riskLevel: 'low' },
  tf_list_projects: { requiredScopes: READ_SCOPES, riskLevel: 'low' },
  tf_get_project_detail: { requiredScopes: CONTACT_SCOPES, riskLevel: 'low' },
  tf_list_tenders: { requiredScopes: READ_SCOPES, riskLevel: 'low' },
  tf_list_bids: { requiredScopes: CONTACT_SCOPES, riskLevel: 'low' },
  tf_list_winners: { requiredScopes: CONTACT_SCOPES, riskLevel: 'low' },
  tf_list_contracts: { requiredScopes: READ_SCOPES, riskLevel: 'low' },
  tf_get_contract_overview: { requiredScopes: READ_SCOPES, riskLevel: 'low' },
  tf_list_tender_plan: { requiredScopes: READ_SCOPES, riskLevel: 'low' },
  tf_list_contacts: { requiredScopes: CONTACT_SCOPES, riskLevel: 'low' },
  tf_list_upcoming_deadlines: { requiredScopes: READ_SCOPES, riskLevel: 'low' },
  tf_prepare_change: { requiredScopes: WRITE_SCOPES, riskLevel: 'medium' },
  tf_confirm_change: { requiredScopes: WRITE_SCOPES, riskLevel: 'high' },
  tf_execute_change: { requiredScopes: WRITE_SCOPES, riskLevel: 'high' },
});

export const getMcpToolPolicy = (toolName) => {
  const policy = TOOL_POLICIES[toolName];
  if (!policy) throw new Error(`MCP tool policy is missing for ${toolName}.`);
  return policy;
};

export const hasMcpScopes = (grantedScopes = [], requiredScopes = []) => {
  const granted = new Set(grantedScopes.map(String));
  return requiredScopes.every((scope) => granted.has(scope));
};

export const getLocalSessionMcpScopes = (grantedScopes = []) => Array.from(new Set([
  ...grantedScopes.map(String).filter((scope) => !scope.startsWith('tenderflow.')),
  MCP_SCOPES.identity,
  MCP_SCOPES.read,
]));

export const assertMcpScopes = (auth, requiredScopes) => {
  const grantedScopes = Array.isArray(auth?.scopes) ? auth.scopes : [];
  const missing = requiredScopes.filter((scope) => !grantedScopes.includes(scope));
  if (missing.length > 0) {
    throw new Error(`MCP OAuth token is missing required tool scopes: ${missing.join(', ')}.`);
  }
};

export const getSupportedMcpScopes = () => [
  MCP_SCOPES.identity,
  'email',
  'profile',
  MCP_SCOPES.read,
  MCP_SCOPES.contactsRead,
  MCP_SCOPES.write,
];
