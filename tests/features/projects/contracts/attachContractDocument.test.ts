import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  uploadContractDocument: vi.fn(),
  updateContract: vi.fn(),
  deleteContractDocument: vi.fn(),
}));

vi.mock('@/features/projects/contracts/api', () => ({
  contractMutationsApi: mocks,
}));

import { attachContractDocument } from '@/features/projects/contracts/utils/attachContractDocument';

describe('attachContractDocument', () => {
  const file = new File(
    [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])],
    'smlouva.pdf',
    { type: 'application/pdf' },
  );
  const metadata = {
    documentStoragePath: 'projects/project-1/contracts/file.pdf',
    documentFileName: 'smlouva.pdf',
    documentMimeType: 'application/pdf',
    documentSize: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploadContractDocument.mockResolvedValue(metadata);
    mocks.updateContract.mockResolvedValue(undefined);
    mocks.deleteContractDocument.mockResolvedValue(undefined);
  });

  it('nahraje dokument a uloží jeho metadata ke stávající smlouvě', async () => {
    await expect(
      attachContractDocument({ contractId: 'contract-1', projectId: 'project-1', file }),
    ).resolves.toEqual(metadata);

    expect(mocks.uploadContractDocument).toHaveBeenCalledWith(file, 'project-1');
    expect(mocks.updateContract).toHaveBeenCalledWith('contract-1', metadata);
    expect(mocks.deleteContractDocument).not.toHaveBeenCalled();
  });

  it('uklidí nahraný soubor, pokud se metadata nepodaří uložit', async () => {
    mocks.updateContract.mockRejectedValue(new Error('Zápis selhal'));

    await expect(
      attachContractDocument({ contractId: 'contract-1', projectId: 'project-1', file }),
    ).rejects.toThrow('Zápis selhal');

    expect(mocks.deleteContractDocument).toHaveBeenCalledWith(metadata.documentStoragePath);
  });

  it('zachová původní chybu, i když selže úklid nahraného souboru', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.updateContract.mockRejectedValue(new Error('Zápis selhal'));
    mocks.deleteContractDocument.mockRejectedValue(new Error('Úklid selhal'));

    try {
      await expect(
        attachContractDocument({ contractId: 'contract-1', projectId: 'project-1', file }),
      ).rejects.toThrow('Zápis selhal');
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
