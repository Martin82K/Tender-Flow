import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createSecurityHeadersConfig,
  createSecurityHeadersMiddleware,
} from './server/securityHeaders.js';
import { handleNodeMcpRequest } from './server/mcp/nodeHandler.js';
import { buildMcpResourceMetadata, jsonResponse } from './server/mcp/response.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const securityConfig = createSecurityHeadersConfig();

const createMetadataRequest = (req) => {
  const protocol = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return new Request(`${protocol}://${host}${req.url}`, {
    headers: {
      'x-forwarded-proto': String(protocol),
      'x-forwarded-host': String(host),
      host: String(req.headers.host || host),
    },
  });
};

app.use(createSecurityHeadersMiddleware(securityConfig));

app.all('/api/mcp', (req, res) => {
  void handleNodeMcpRequest(req, res).catch((error) => {
    console.error('[MCP] request failed:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'mcp_server_error' });
    } else {
      res.end();
    }
  });
});

app.get('/api/mcp-resource', async (req, res) => {
  const request = createMetadataRequest(req);
  const response = jsonResponse(200, buildMcpResourceMetadata(request));
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(await response.text());
});

app.get('/.well-known/oauth-protected-resource', async (req, res) => {
  const request = createMetadataRequest(req);
  const response = jsonResponse(200, buildMcpResourceMetadata(request));
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(await response.text());
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`CORS mode: ${securityConfig.allowAllOrigins ? 'allow-all' : 'allowlist'}`);
  console.log(`Frame ancestors: ${securityConfig.frameAncestors}`);
});
