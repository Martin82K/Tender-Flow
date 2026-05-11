import { buildMcpResourceMetadata, jsonResponse } from '../server/mcp/response.js';

export default async function handler(req, res) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const request = new Request(`${protocol}://${host}${req.url}`, {
    headers: {
      'x-forwarded-proto': String(protocol),
      'x-forwarded-host': String(host),
      host: String(req.headers.host || host),
    },
  });
  const response = jsonResponse(200, buildMcpResourceMetadata(request));
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(await response.text());
}
