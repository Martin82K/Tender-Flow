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

import { shortenUrl } from '@/services/urlShortenerService';

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
});
