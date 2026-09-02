const hasMetadataValue = (value, expected) =>
  Array.isArray(value) && value.some((item) => item === expected);

export const validateMcpRefreshDiscovery = (authorizationServerMetadata, resourceScopes) => {
  if (!hasMetadataValue(authorizationServerMetadata?.grant_types_supported, 'refresh_token')) {
    throw new Error('OAuth authorization server does not advertise the refresh_token grant.');
  }
  if (!hasMetadataValue(authorizationServerMetadata?.scopes_supported, 'offline_access')) {
    throw new Error('OAuth authorization server does not advertise offline_access.');
  }
  if (hasMetadataValue(resourceScopes, 'offline_access')) {
    throw new Error('MCP protected-resource metadata must not advertise offline_access.');
  }
};
