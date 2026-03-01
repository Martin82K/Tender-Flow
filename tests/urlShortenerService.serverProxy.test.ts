import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeAuthedFunctionMock = vi.fn();
const maybeSingleMock = vi.fn();
const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock('@/services/functionsClient', () => ({
  invokeAuthedFunction: (...args: unknown[]) => invokeAuthedFunctionMock(...args),
}));

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
    },
    from: (...args: unknown[]) => fromMock(...args),
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
      body: { url: 'https://example.com' },
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
      body: { url: 'https://example.org' },
    });
    expect(result.success).toBe(true);
    expect(result.shortUrl).toBe('https://tinyurl.com/no-alias');
  });
});
