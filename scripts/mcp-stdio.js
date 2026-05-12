#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createTenderFlowMcpServer } from '../server/mcp/tenderFlowMcp.js';
import { verifyLocalMcpAccessToken } from '../server/mcp/supabaseAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(process.env.CLAUDE_PROJECT_DIR || process.env.CODEX_PROJECT_DIR || path.join(__dirname, '..'));

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    const value = rawValue
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');
    process.env[key] = value;
  }
};

const isTruthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());

const main = async () => {
  loadEnvFile(path.join(repoRoot, '.env.local'));

  const accessToken = process.env.TENDER_FLOW_MCP_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;
  const auth = await verifyLocalMcpAccessToken(accessToken);
  const readOnly = isTruthy(process.env.TENDER_FLOW_MCP_READ_ONLY);
  const includeWriteTools = auth.hasOAuthClientId && !readOnly;
  const server = createTenderFlowMcpServer(auth, { includeWriteTools });
  const transport = new StdioServerTransport();

  if (!auth.hasOAuthClientId) {
    console.error('[Tender Flow MCP] Local Supabase session token detected; running read-only tools only.');
  }

  await server.connect(transport);
};

main().catch((error) => {
  console.error(`[Tender Flow MCP] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
