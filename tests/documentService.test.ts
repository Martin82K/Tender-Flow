import { beforeEach, describe, expect, it, vi } from 'vitest';

const uploadMock = vi.fn();
const removeMock = vi.fn();
const getPublicUrlMock = vi.fn();
const fromMock = vi.fn(() => ({
  upload: uploadMock,
  remove: removeMock,
  getPublicUrl: getPublicUrlMock,
}));
const isDemoSessionMock = vi.fn(() => false);

vi.mock('../services/supabase', () => ({
  supabase: {
    storage: {
      from: (...args: unknown[]) => fromMock(...args),
    },
  },
}));

vi.mock('../services/demoData', () => ({
  isDemoSession: () => isDemoSessionMock(),
}));

describe('documentService', () => {
  beforeEach(() => {
    uploadMock.mockReset();
    removeMock.mockReset();
    getPublicUrlMock.mockReset();
    fromMock.mockClear();
    isDemoSessionMock.mockReset();
    isDemoSessionMock.mockReturnValue(false);
    vi.restoreAllMocks();
  });

  it('při chybě uploadu loguje jen sanitizované detaily', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    uploadMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Upload selhal pro john@example.com',
        details: 'authorization=Bearer secret-token',
      },
    });

    const { uploadDocument } = await import('../services/documentService');

    const file = new File(['demo'], 'offer.pdf', { type: 'application/pdf' });

    await expect(uploadDocument(file, 'category-1')).rejects.toThrow('Failed to upload document');

    const loggedPayload = JSON.stringify(consoleErrorSpy.mock.calls[0]?.[1]);
    expect(loggedPayload).toContain('[redacted-email]');
    expect(loggedPayload).toContain('[redacted-token]');
    expect(loggedPayload).not.toContain('john@example.com');
    expect(loggedPayload).not.toContain('secret-token');
  });
});
