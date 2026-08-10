import { nodeRequestToWebRequest, sendWebResponseToNode } from './nodeHandler.js';

export const resolveMcpUpstreamUrl = (value) => {
  const configured = value?.trim();
  if (!configured) return null;

  const url = new URL(configured);
  if (url.protocol !== 'https:') {
    throw new Error('MCP upstream must use HTTPS.');
  }
  if (url.username || url.password) {
    throw new Error('MCP upstream must not contain credentials.');
  }
  if (url.pathname !== '/api/mcp' || url.search || url.hash) {
    throw new Error('MCP upstream must use the exact /api/mcp path without query or fragment.');
  }
  return url;
};

export const proxyNodeMcpRequest = async (req, res, upstreamUrl) => {
  const webRequest = nodeRequestToWebRequest(req);
  const incomingUrl = new URL(webRequest.url);
  if (incomingUrl.origin === upstreamUrl.origin && incomingUrl.pathname === upstreamUrl.pathname) {
    throw new Error('MCP upstream must not point back to the public proxy endpoint.');
  }

  const headers = new Headers(webRequest.headers);
  headers.delete('connection');
  headers.delete('content-length');
  headers.delete('host');
  headers.set('x-forwarded-host', incomingUrl.host);
  headers.set('x-forwarded-proto', incomingUrl.protocol.replace(':', ''));

  const canHaveBody = webRequest.method !== 'GET' && webRequest.method !== 'HEAD';
  const upstreamResponse = await fetch(upstreamUrl, {
    method: webRequest.method,
    headers,
    body: canHaveBody ? webRequest.body : undefined,
    duplex: canHaveBody ? 'half' : undefined,
    redirect: 'manual',
  });
  await sendWebResponseToNode(upstreamResponse, res);
};
