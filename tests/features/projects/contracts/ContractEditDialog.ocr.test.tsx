import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractExtractionResult } from '@/types';

const mocks = vi.hoisted(() => ({
  extractFromDocument: vi.fn(),
  uploadContractDocument: vi.fn(),
  deleteContractDocument: vi.fn(),
  createContract: vi.fn(),
  updateContract: vi.fn(),
  createMarkdownVersion: vi.fn(),
}));

vi.mock('@/services/contractExtractionService', () => ({
  contractExtractionService: { extractFromDocument: mocks.extractFromDocument },
}));

vi.mock('@/features/projects/contracts/api', () => ({
  contractMutationsApi: {
    uploadContractDocument: mocks.uploadContractDocument,
    deleteContractDocument: mocks.deleteContractDocument,
    createContract: mocks.createContract,
    updateContract: mocks.updateContract,
    createMarkdownVersion: mocks.createMarkdownVersion,
  },
}));

import { ContractEditDialog } from '@/features/projects/contracts/forms/ContractEditDialog';

describe('ContractEditDialog OCR create flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploadContractDocument.mockResolvedValue({
      documentStoragePath: 'projects/project-1/contracts/file.pdf',
      documentFileName: 'smlouva.pdf',
      documentMimeType: 'application/pdf',
      documentSize: 5,
    });
    mocks.createContract.mockResolvedValue({ id: 'contract-1' });
    mocks.createMarkdownVersion.mockResolvedValue({ id: 'markdown-1' });
  });

  it('čeká na OCR, předvyplní formulář a standardně připojí originál', async () => {
    let resolveOcr: (result: ContractExtractionResult) => void = () => undefined;
    mocks.extractFromDocument.mockReturnValue(
      new Promise<ContractExtractionResult>((resolve) => {
        resolveOcr = resolve;
      }),
    );
    const onSaved = vi.fn();
    render(
      <ContractEditDialog
        projectId="project-1"
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    const file = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])],
      'smlouva.pdf',
      { type: 'application/pdf' },
    );
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText('Čekám na OCR…')).toBeDisabled());

    resolveOcr({
      fields: {
        title: 'SOD – fasáda',
        vendorName: 'Dodavatel s.r.o.',
        contractNumber: 'SOD-2026-08',
        basePrice: 250_000,
        retentionShortPercent: 7,
        retentionLongPercent: 3,
      },
      confidence: { title: 0.9, vendorName: 0.9 },
      rawText: 'Text smlouvy '.repeat(20),
      sourceFileName: 'smlouva.pdf',
      ocrProvider: 'mistral-ocr',
      ocrModel: 'mistral-ocr-latest',
    });

    await waitFor(() => expect(screen.getByDisplayValue('SOD – fasáda')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Dodavatel s.r.o.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Připojit originální soubor ke smlouvě/)).toBeChecked();

    fireEvent.click(screen.getByText('Vytvořit smlouvu'));

    await waitFor(() => expect(mocks.uploadContractDocument).toHaveBeenCalledWith(file, 'project-1'));
    expect(mocks.createContract).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'SOD – fasáda',
        vendorName: 'Dodavatel s.r.o.',
        source: 'ai_extracted',
        retentionShortPercent: 7,
        retentionLongPercent: 3,
        documentStoragePath: 'projects/project-1/contracts/file.pdf',
      }),
    );
    expect(mocks.createMarkdownVersion).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: 'contract-1', sourceKind: 'ocr' }),
    );
    expect(onSaved).toHaveBeenCalled();
  });
});
