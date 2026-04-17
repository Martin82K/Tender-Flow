import { beforeEach, describe, expect, it, vi } from 'vitest';

const uploadMock = vi.fn();
const removeMock = vi.fn();
const createSignedUrlMock = vi.fn();
const fromMock = vi.fn(() => ({
  upload: uploadMock,
  remove: removeMock,
  createSignedUrl: createSignedUrlMock,
}));
const isDemoSessionMock = vi.fn(() => false);

vi.mock('../services/supabase', () => ({
  supabase: {
    storage: {
      from: fromMock,
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
    createSignedUrlMock.mockReset();
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

  it('po uploadu ukládá interní storage cestu místo veřejné URL', async () => {
    uploadMock.mockResolvedValue({ data: { path: 'ok' }, error: null });

    const { uploadDocument } = await import('../services/documentService');

    const file = new File(['demo'], 'offer.pdf', { type: 'application/pdf' });
    const document = await uploadDocument(file, 'category-1');

    expect(document.url).toMatch(/^category-1\//);
    expect(document.url).not.toContain('/storage/v1/object/public/');
  });

  it('getDocumentUrl vrací podepsanou URL pro interní storage cestu', async () => {
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: 'https://example.supabase.co/storage/v1/object/sign/demand-documents/private.pdf?token=abc' },
      error: null,
    });

    const { getDocumentUrl } = await import('../services/documentService');

    await expect(getDocumentUrl('category-1/private.pdf')).resolves.toContain('/object/sign/');
    expect(createSignedUrlMock).toHaveBeenCalledWith('category-1/private.pdf', 900);
  });
});
