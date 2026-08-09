import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock('@/services/supabase', () => ({
  supabase: {
    storage: { from: mocks.storageFrom },
    auth: { getUser: vi.fn() },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('@/services/functionsClient', () => ({ invokeAuthedFunction: vi.fn() }));

import { contractService } from '@/services/contractService';

describe('contractService documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storageFrom.mockReturnValue({
      upload: mocks.upload,
      remove: mocks.remove,
      createSignedUrl: mocks.createSignedUrl,
    });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null });
  });

  it('uloží validované PDF do privátního bucketu bez upsertu', async () => {
    const file = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])],
      'Smlouva.pdf',
      { type: 'application/pdf' },
    );

    await expect(contractService.uploadContractDocument(file, 'project-1')).resolves.toMatchObject({
      documentFileName: 'Smlouva.pdf',
      documentMimeType: 'application/pdf',
      documentSize: 5,
    });
    expect(mocks.storageFrom).toHaveBeenCalledWith('contract-documents');
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^projects\/project-1\/contracts\/[A-Za-z0-9-]+\.pdf$/),
      file,
      expect.objectContaining({ upsert: false, contentType: 'application/pdf' }),
    );
  });

  it('vytvoří krátkodobý signed URL až při otevření', async () => {
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/document.pdf' },
      error: null,
    });
    await expect(
      contractService.getContractDocumentUrl({
        documentStoragePath: 'projects/project-1/contracts/file.pdf',
      }),
    ).resolves.toBe('https://signed.example/document.pdf');
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(
      'projects/project-1/contracts/file.pdf',
      900,
    );
  });
});
