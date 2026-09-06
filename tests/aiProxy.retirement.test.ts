// @vitest-environment node
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

function loadHandler(tier = 'enterprise') {
  let handler: (req: Request) => Promise<Response>;
  const rpc = vi.fn(async () => ({ data: tier, error: null }));
  const fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'user-1' })));
  const source = fs.readFileSync('supabase/functions/ai-proxy/index.ts', 'utf8')
    .replace(/^import .*;$/gm, '');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  });
  vm.runInNewContext(outputText, {
    Request, Response, URL, console: { log() {}, error() {} }, fetch,
    createClient: () => ({ rpc }),
    requireActiveSubscription: async () => tier === 'free' ? new Response(null, { status: 402 }) : null,
    handleCors: () => null, buildCorsHeaders: () => ({}),
    Deno: {
      env: { get: (key: string) => key === 'SUPABASE_URL' ? 'https://example.supabase.co' : 'test' },
      serve: (callback: typeof handler) => { handler = callback; },
    },
  });
  return { request: (body: unknown) => handler(new Request('https://example.test', {
    method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify(body),
  })), rpc, fetch };
}

describe('AI proxy after assistant removal', () => {
  it.each(['memory-load', 'memory-save'])('retires %s without accessing storage or a provider', async (action) => {
    const app = loadHandler();
    const response = await app.request({ action, projectId: 'project-1' });
    expect(response.status).toBe(410);
    expect(app.rpc).not.toHaveBeenCalled();
    expect(app.fetch).toHaveBeenCalledTimes(1); // Authentication only.
  });

  it('keeps the Mistral model list available to a subscribed user without an assistant flag', async () => {
    const app = loadHandler();
    const response = await app.request({ action: 'list-models', provider: 'mistral' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ models: expect.arrayContaining([
      expect.objectContaining({ provider: 'mistral' }),
    ]) });
    expect(app.rpc).toHaveBeenCalledWith('get_user_subscription_tier', { target_user_id: 'user-1' });
    expect(app.fetch).toHaveBeenCalledTimes(1);
  });

  it('continues to reject model discovery for a user without a subscription', async () => {
    const app = loadHandler('free');
    expect((await app.request({ action: 'list-models', provider: 'mistral' })).status).toBe(402);
  });
});
