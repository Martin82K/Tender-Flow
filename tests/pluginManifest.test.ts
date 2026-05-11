import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const pluginRoot = join(root, 'plugins', 'tender-flow-cz');

const readJson = <T>(path: string): T => {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
};

describe('Tender Flow CZ plugin manifest', () => {
  it('points to the remote Tender Flow MCP server', () => {
    const plugin = readJson<{
      name: string;
      mcpServers: string;
      interface: {
        displayName: string;
        capabilities: string[];
        privacyPolicyURL: string;
        termsOfServiceURL: string;
      };
    }>(join(pluginRoot, '.codex-plugin', 'plugin.json'));
    const mcp = readJson<{
      mcpServers: Record<string, { type: string; url: string; note: string }>;
    }>(join(pluginRoot, '.mcp.json'));

    expect(plugin.name).toBe('tender-flow-cz');
    expect(plugin.mcpServers).toBe('./.mcp.json');
    expect(plugin.interface.displayName).toBe('Tender Flow CZ');
    expect(plugin.interface.capabilities).toEqual(expect.arrayContaining(['Read', 'Write']));
    expect(plugin.interface.privacyPolicyURL).toBe('https://tenderflow.cz/privacy');
    expect(plugin.interface.termsOfServiceURL).toBe('https://tenderflow.cz/terms');
    expect(mcp.mcpServers['tender-flow-cz']).toMatchObject({
      type: 'http',
      url: 'https://tenderflow.cz/api/mcp',
    });
    expect(mcp.mcpServers['tender-flow-cz'].note).toContain('OAuth');
  });

  it('publishes the plugin through the local marketplace entry', () => {
    const marketplace = readJson<{
      plugins: Array<{
        name: string;
        source: { source: string; path: string };
        policy: { installation: string; authentication: string };
        category: string;
      }>;
    }>(join(root, '.agents', 'plugins', 'marketplace.json'));

    expect(marketplace.plugins).toContainEqual({
      name: 'tender-flow-cz',
      source: { source: 'local', path: './plugins/tender-flow-cz' },
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
      category: 'Productivity',
    });
  });

  it('does not store secrets in the plugin MCP config', () => {
    const mcpConfig = readFileSync(join(pluginRoot, '.mcp.json'), 'utf8');

    expect(mcpConfig).not.toMatch(/service[_-]?role/i);
    expect(mcpConfig).not.toMatch(/anon[_-]?key/i);
    expect(mcpConfig).not.toMatch(/bearer\s+[a-z0-9._-]+/i);
    expect(mcpConfig).not.toMatch(/access[_-]?token/i);
    expect(mcpConfig).not.toMatch(/refresh[_-]?token/i);
  });
});
