import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractWithDetails } from '@/types';

const mocks = vi.hoisted(() => ({
  deleteContract: vi.fn(),
  deleteContractDocument: vi.fn(),
  updateContract: vi.fn(),
  uploadContractDocument: vi.fn(),
}));

vi.mock('@/features/projects/contracts/api', () => ({
  contractMutationsApi: mocks,
}));

import {
  deleteContractWithDocuments,
  updateContractWithDocumentChange,
} from '@/features/projects/contracts/utils/contractCrud';

const contract = {
  id: 'contract-1',
  projectId: 'project-1',
  vendorName: 'Dodavatel s.r.o.',
  title: 'SOD',
  status: 'active',
  currency: 'CZK',
  basePrice: 100,
  source: 'manual',
  documentStoragePath: 'projects/project-1/contracts/old.pdf',
  documentFileName: 'old.pdf',
  amendments: [
    {
      id: 'amendment-1',
      contractId: 'contract-1',
      amendmentNo: 1,
      deltaPrice: 0,
      documentStoragePath: 'projects/project-1/contracts/amendment.pdf',
    },
  ],
  drawdowns: [],
  invoices: [],
  currentTotal: 100,
  approvedSum: 0,
  remaining: 100,
  invoicedSum: 0,
  paidSum: 0,
  overdueSum: 0,
} satisfies ContractWithDetails;

describe('contract CRUD orchestrace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateContract.mockResolvedValue(undefined);
    mocks.uploadContractDocument.mockResolvedValue({
      documentStoragePath: 'projects/project-1/contracts/new.pdf',
      documentFileName: 'new.pdf',
      documentMimeType: 'application/pdf',
      documentSize: 5,
    });
    mocks.deleteContractDocument.mockResolvedValue(undefined);
    mocks.deleteContract.mockResolvedValue(undefined);
  });

  it('nahraje náhradu, atomicky přepojí metadata a až potom uklidí starý soubor', async () => {
    const file = new File(['%PDF-'], 'new.pdf', { type: 'application/pdf' });

    await expect(
      updateContractWithDocumentChange({
        contract,
        updates: { title: 'Upravená SOD' },
        replacementFile: file,
      }),
    ).resolves.toEqual({ cleanupWarning: null });

    expect(mocks.uploadContractDocument).toHaveBeenCalledWith(file, 'project-1');
    expect(mocks.updateContract).toHaveBeenCalledWith(
      'contract-1',
      expect.objectContaining({
        title: 'Upravená SOD',
        documentStoragePath: 'projects/project-1/contracts/new.pdf',
      }),
    );
    expect(mocks.deleteContractDocument).toHaveBeenCalledWith(
      'projects/project-1/contracts/old.pdf',
    );
    expect(mocks.updateContract.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteContractDocument.mock.invocationCallOrder[0],
    );
  });

  it('uklidí nově nahraný soubor, pokud se přepojení metadat nepodaří', async () => {
    const file = new File(['%PDF-'], 'new.pdf', { type: 'application/pdf' });
    mocks.updateContract.mockRejectedValue(new Error('Zápis selhal'));

    await expect(
      updateContractWithDocumentChange({ contract, updates: {}, replacementFile: file }),
    ).rejects.toThrow('Zápis selhal');

    expect(mocks.deleteContractDocument).toHaveBeenCalledWith(
      'projects/project-1/contracts/new.pdf',
    );
    expect(mocks.deleteContractDocument).not.toHaveBeenCalledWith(
      'projects/project-1/contracts/old.pdf',
    );
  });

  it('při odpojení nejdřív vyčistí metadata a potom smaže soubor', async () => {
    await updateContractWithDocumentChange({
      contract,
      updates: { title: 'SOD bez přílohy' },
      removeDocument: true,
    });

    expect(mocks.updateContract).toHaveBeenCalledWith(
      'contract-1',
      expect.objectContaining({
        title: 'SOD bez přílohy',
        documentUrl: '',
        documentStoragePath: '',
        documentFileName: '',
        documentMimeType: '',
        documentSize: 0,
      }),
    );
    expect(mocks.updateContract.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteContractDocument.mock.invocationCallOrder[0],
    );
  });

  it('smaže databázový záznam před úklidem příloh smlouvy a dodatků', async () => {
    await expect(deleteContractWithDocuments(contract)).resolves.toEqual({ cleanupWarning: null });

    expect(mocks.deleteContract).toHaveBeenCalledWith('contract-1');
    expect(mocks.deleteContractDocument).toHaveBeenCalledTimes(2);
    expect(mocks.deleteContract.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteContractDocument.mock.invocationCallOrder[0],
    );
  });

  it('vrátí varování, když je smlouva smazaná, ale některou přílohu nelze uklidit', async () => {
    mocks.deleteContractDocument.mockRejectedValueOnce(new Error('Storage selhal'));

    await expect(deleteContractWithDocuments(contract)).resolves.toEqual({
      cleanupWarning: expect.stringContaining('příloh'),
    });
  });
});
