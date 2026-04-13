import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const invokeAuthedFunction = vi.fn();
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { invokeAuthedFunction, maybeSingle, eq, select, from };
});

const invokeAuthedFunctionMock = mocks.invokeAuthedFunction;
const maybeSingleMock = mocks.maybeSingle;
const eqMock = mocks.eq;
const selectMock = mocks.select;
const fromMock = mocks.from;

vi.mock('@/services/functionsClient', () => ({
  invokeAuthedFunction: (name: string, opts: unknown) => mocks.invokeAuthedFunction(name, opts),
}));

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
    },
    from: mocks.from,
    rpc: vi.fn(),
  },
}));

import { shortenUrl, shortenUrlWithAlias } from '@/services/urlShortenerService';

describe('urlShortenerService server proxy', () => {
  beforeEach(() => {
    invokeAuthedFunctionMock.mockReset();
    maybeSingleMock.mockReset();
    eqMock.mockClear();
    selectMock.mockClear();
    fromMock.mockClear();
    vi.restoreAllMocks();
  });

  it('pro tinyurl provider volá serverovou function url-shorten', async () => {
    maybeSingleMock.mockResolvedValue({
      data: { preferences: { urlShortenerProvider: 'tinyurl' } },
    });

    invokeAuthedFunctionMock.mockResolvedValue({
      success: true,
      shortUrl: 'https://tinyurl.com/demo',
      originalUrl: 'https://example.com',
      provider: 'tinyurl',
    });

    const result = await shortenUrl('https://example.com');

    expect(invokeAuthedFunctionMock).toHaveBeenCalledWith('url-shorten', {
      body: { url: 'https://example.com/' },
    });
    expect(result.success).toBe(true);
    expect(result.provider).toBe('tinyurl');
    expect(result.shortUrl).toBe('https://tinyurl.com/demo');
  });

  it('shortenUrlWithAlias bez aliasu deleguje na provider flow', async () => {
    maybeSingleMock.mockResolvedValue({
      data: { preferences: { urlShortenerProvider: 'tinyurl' } },
    });

    invokeAuthedFunctionMock.mockResolvedValue({
      success: true,
      shortUrl: 'https://tinyurl.com/no-alias',
      originalUrl: 'https://example.org',
      provider: 'tinyurl',
    });

    const result = await shortenUrlWithAlias('https://example.org');

    expect(invokeAuthedFunctionMock).toHaveBeenCalledWith('url-shorten', {
      body: { url: 'https://example.org/' },
    });
    expect(result.success).toBe(true);
    expect(result.shortUrl).toBe('https://tinyurl.com/no-alias');
  });

  it('při chybě tinyurl loguje jen sanitizované detaily', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    maybeSingleMock.mockResolvedValue({
      data: { preferences: { urlShortenerProvider: 'tinyurl' } },
    });

    invokeAuthedFunctionMock.mockRejectedValue(
      new Error('URL shortener failed for john@example.com token Bearer abc.def.ghi'),
    );

    const result = await shortenUrl('https://example.com/secret');

    expect(result.success).toBe(false);
    const loggedPayload = JSON.stringify(consoleErrorSpy.mock.calls[0]?.[1]);
    expect(loggedPayload).toContain('[redacted-email]');
    expect(loggedPayload).toContain('[redacted-token]');
    expect(loggedPayload).not.toContain('john@example.com');
    expect(loggedPayload).not.toContain('abc.def.ghi');
  });
});
