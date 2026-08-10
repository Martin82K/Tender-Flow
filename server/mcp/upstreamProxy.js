import { nodeRequestToWebRequest, sendWebResponseToNode } from './nodeHandler.js';

const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const AUTOMATICALLY_DECODED_ENCODINGS = new Set(['br', 'deflate', 'gzip']);

const removeHopByHopHeaders = (headers) => {
  const connectionHeaders = (headers.get('connection') || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => HEADER_NAME_PATTERN.test(value));
  for (const header of [...HOP_BY_HOP_HEADERS, ...connectionHeaders]) {
    headers.delete(header);
  }
};

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
  removeHopByHopHeaders(headers);
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
  const responseHeaders = new Headers(upstreamResponse.headers);
  removeHopByHopHeaders(responseHeaders);
  const contentEncodings = (responseHeaders.get('content-encoding') || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const wasAutomaticallyDecoded = contentEncodings.length > 0
    && contentEncodings.every((encoding) => AUTOMATICALLY_DECODED_ENCODINGS.has(encoding));
  if (wasAutomaticallyDecoded) {
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');
  }
  await sendWebResponseToNode(new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  }), res);
};
