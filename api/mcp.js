import { handleNodeMcpRequest } from '../server/mcp/nodeHandler.js';
import { proxyNodeMcpRequest, resolveMcpUpstreamUrl } from '../server/mcp/upstreamProxy.js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  try {
    const upstreamUrl = resolveMcpUpstreamUrl(process.env.MCP_UPSTREAM_URL);
    if (upstreamUrl) {
      await proxyNodeMcpRequest(req, res, upstreamUrl);
      return;
    }
    await handleNodeMcpRequest(req, res);
  } catch {
    res.statusCode = 503;
    res.setHeader('cache-control', 'private, no-store');
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      error: 'mcp_upstream_unavailable',
      message: 'MCP service is temporarily unavailable.',
    }));
  }
}
