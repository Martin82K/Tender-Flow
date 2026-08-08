#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createTenderFlowMcpServer } from '../server/mcp/tenderFlowMcp.js';
import { getLocalSessionMcpScopes } from '../server/mcp/scopePolicy.js';
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

  if (!auth.hasOAuthClientId) {
    auth.scopes = getLocalSessionMcpScopes(auth.scopes);
    console.error('[Tender Flow MCP] Local Supabase session token detected; running general read-only tools without contact data.');
  }

  serveStdio(
    () => createTenderFlowMcpServer(auth, { includeWriteTools }),
    {
      legacy: 'serve',
      onerror: (error) => {
        console.error(`[Tender Flow MCP] ${error instanceof Error ? error.message : String(error)}`);
      },
    },
  );
};

main().catch((error) => {
  console.error(`[Tender Flow MCP] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
