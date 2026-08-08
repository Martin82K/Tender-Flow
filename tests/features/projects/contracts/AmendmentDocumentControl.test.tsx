import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractAmendment } from '@/types';

const mocks = vi.hoisted(() => ({
  attachAmendmentDocument: vi.fn(),
  getAmendmentDocumentUrl: vi.fn(),
}));

vi.mock('@/features/projects/contracts/utils/attachAmendmentDocument', () => ({
  attachAmendmentDocument: mocks.attachAmendmentDocument,
}));

vi.mock('@/features/projects/contracts/api', () => ({
  contractQueriesApi: {
    getAmendmentDocumentUrl: mocks.getAmendmentDocumentUrl,
  },
}));

import { AmendmentDocumentControl } from '@/features/projects/contracts/documents/AmendmentDocumentControl';

const amendment: ContractAmendment = {
  id: 'amendment-1',
  contractId: 'contract-1',
  amendmentNo: 1,
  deltaPrice: 100,
};

describe('AmendmentDocumentControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.attachAmendmentDocument.mockResolvedValue(undefined);
    mocks.getAmendmentDocumentUrl.mockResolvedValue('https://example.test/dodatek.pdf');
  });

  it('připojí PDF ke konkrétnímu dodatku bez spuštění OCR', async () => {
    const onChanged = vi.fn();
    render(
      <AmendmentDocumentControl
        amendment={amendment}
        projectId="project-1"
        onChanged={onChanged}
      />,
    );

    const file = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])],
      'dodatek.pdf',
      { type: 'application/pdf' },
    );
    fireEvent.change(screen.getByLabelText('Připojit dokument k dodatku č. 1'), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(mocks.attachAmendmentDocument).toHaveBeenCalledWith({
        amendmentId: amendment.id,
        projectId: 'project-1',
        file,
      });
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it('otevře uložený dokument přes časově omezenou adresu', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const amendmentWithDocument: ContractAmendment = {
      ...amendment,
      documentStoragePath: 'projects/project-1/contracts/amendment.pdf',
      documentFileName: 'dodatek.pdf',
      documentMimeType: 'application/pdf',
      documentSize: 5,
    };
    render(
      <AmendmentDocumentControl
        amendment={amendmentWithDocument}
        projectId="project-1"
        onChanged={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Otevřít dokument dodatku č. 1' }));

    await waitFor(() => {
      expect(mocks.getAmendmentDocumentUrl).toHaveBeenCalledWith(amendmentWithDocument);
      expect(open).toHaveBeenCalledWith(
        'https://example.test/dodatek.pdf',
        '_blank',
        'noopener,noreferrer',
      );
    });
    open.mockRestore();
  });
});
