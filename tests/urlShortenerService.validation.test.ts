import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/functionsClient', () => ({
  invokeAuthedFunction: vi.fn(),
}));

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } })),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { isAllowedShortUrlDestination } from '@/services/urlShortenerService';

describe('isAllowedShortUrlDestination', () => {
  it('allows http and https urls', () => {
    expect(isAllowedShortUrlDestination('https://example.com/path')).toBe(true);
    expect(isAllowedShortUrlDestination('http://example.com')).toBe(true);
  });

  it('rejects dangerous and unsupported schemes', () => {
    expect(isAllowedShortUrlDestination('javascript:alert(1)')).toBe(false);
    expect(isAllowedShortUrlDestination('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isAllowedShortUrlDestination('ftp://example.com')).toBe(false);
    expect(isAllowedShortUrlDestination('/relative/path')).toBe(false);
  });
});
