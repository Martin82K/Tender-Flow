import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDocument } from '@/features/projects/contracts/api/openDocument';

vi.mock('@infra/platform/platformAdapter', () => ({ isDesktop: false, shellAdapter: { openExternal: vi.fn() } }));

describe('mobile document opening', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reserves the tab before waiting for authorization and removes opener access', async () => {
    const tab = { opener: window, location: { replace: vi.fn() }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const getUrl = vi.fn(async () => {
      expect(open).toHaveBeenCalledWith('about:blank', '_blank');
      expect(tab.opener).toBeNull();
      return 'https://signed.example/offer.pdf';
    });
    await openDocument(getUrl);
    expect(tab.location.replace).toHaveBeenCalledWith('https://signed.example/offer.pdf');
    expect(tab.close).not.toHaveBeenCalled();
  });

  it('closes the reserved tab if authorization fails', async () => {
    const tab = { opener: null, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    await expect(openDocument(async () => { throw new Error('denied'); })).rejects.toThrow('denied');
    expect(tab.close).toHaveBeenCalled();
  });

  it('reports a blocked popup without requesting a signed URL', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const getUrl = vi.fn();
    await expect(openDocument(getUrl)).rejects.toThrow('zablokoval');
    expect(getUrl).not.toHaveBeenCalled();
  });

  it('rejects executable links', async () => {
    const tab = { opener: null, location: { replace: vi.fn() }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    await expect(openDocument(async () => 'javascript:alert(1)')).rejects.toThrow('Neplatný');
    expect(tab.location.replace).not.toHaveBeenCalled();
  });
});
