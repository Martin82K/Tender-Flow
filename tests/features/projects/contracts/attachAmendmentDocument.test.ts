import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  uploadAmendmentDocument: vi.fn(),
  updateAmendment: vi.fn(),
  deleteAmendmentDocument: vi.fn(),
}));

vi.mock('@/features/projects/contracts/api', () => ({
  contractMutationsApi: mocks,
}));

import { attachAmendmentDocument } from '@/features/projects/contracts/utils/attachAmendmentDocument';

describe('attachAmendmentDocument', () => {
  const file = new File(
    [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])],
    'dodatek.pdf',
    { type: 'application/pdf' },
  );
  const metadata = {
    documentStoragePath: 'projects/project-1/contracts/amendment.pdf',
    documentFileName: 'dodatek.pdf',
    documentMimeType: 'application/pdf',
    documentSize: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploadAmendmentDocument.mockResolvedValue(metadata);
    mocks.updateAmendment.mockResolvedValue(undefined);
    mocks.deleteAmendmentDocument.mockResolvedValue(undefined);
  });

  it('uloží metadata souboru ke konkrétnímu dodatku', async () => {
    await attachAmendmentDocument({
      amendmentId: 'amendment-1',
      projectId: 'project-1',
      file,
    });

    expect(mocks.uploadAmendmentDocument).toHaveBeenCalledWith(file, 'project-1');
    expect(mocks.updateAmendment).toHaveBeenCalledWith('amendment-1', metadata);
  });

  it('uklidí soubor, pokud se metadata dodatku nepodaří uložit', async () => {
    mocks.updateAmendment.mockRejectedValue(new Error('Zápis selhal'));

    await expect(
      attachAmendmentDocument({
        amendmentId: 'amendment-1',
        projectId: 'project-1',
        file,
      }),
    ).rejects.toThrow('Zápis selhal');

    expect(mocks.deleteAmendmentDocument).toHaveBeenCalledWith(
      metadata.documentStoragePath,
    );
  });
});
