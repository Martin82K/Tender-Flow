import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ service: vi.fn() }));
vi.mock('../supabase/functions/_shared/supabase.ts', () => ({ createServiceClient: mocks.service }));
vi.mock('../supabase/functions/_shared/crypto.ts', () => ({ encryptJsonAesGcm: vi.fn(), tryGetEnv: vi.fn() }));
let handler: (request: Request) => Promise<Response>;
beforeAll(async () => {
  vi.stubGlobal('Deno', {
    env: { get: (key: string) => key === 'SITE_URL' ? 'https://tenderflow.cz' : undefined },
    serve: (callback: typeof handler) => { handler = callback; },
  });
  await import('../supabase/functions/dochub-google-callback/index');
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => { mocks.service.mockReset(); });

describe('Google OAuth callback redirects', () => {
  it.each([
    ['', 'missing_code_or_state'],
    ['?code=test&state=wrong.nonce', 'invalid_state'],
    ['?error=access_denied', 'access_denied'],
  ])('returns a safe redirect for %s using the current request origin', async (query, error) => {
    const response = await handler(new Request(`https://example.test/callback${query}`, {
      headers: { origin: 'https://www.tenderflow.cz' },
    }));
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location')!);
    expect(location.origin).toBe('https://tenderflow.cz');
    expect(location.searchParams.get('dochub_error')).toBe(error);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://www.tenderflow.cz');
    expect(mocks.service).not.toHaveBeenCalled();
  });

  it('redirects a caught failure without throwing again or reflecting an untrusted origin', async () => {
    mocks.service.mockImplementation(() => { throw new Error('test service unavailable'); });
    const response = await handler(new Request('https://example.test/callback?code=test&state=gdrive.nonce', {
      headers: { origin: 'https://untrusted.example' },
    }));
    expect(response.status).toBe(302);
    expect(new URL(response.headers.get('location')!).searchParams.get('dochub_error')).toBe('test service unavailable');
    expect(response.headers.get('access-control-allow-origin')).toBe('https://tenderflow.cz');
  });
});
