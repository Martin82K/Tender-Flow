import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractWithDetails } from '@/types';

const mocks = vi.hoisted(() => ({
  deleteAmendment: vi.fn(),
  deleteAmendmentDocument: vi.fn(),
}));

vi.mock('@/features/projects/contracts/api', () => ({
  contractMutationsApi: mocks,
}));

vi.mock('@/features/projects/contracts/documents/AmendmentDocumentControl', () => ({
  AmendmentDocumentControl: () => <span>Dokument dodatku</span>,
}));

import { AmendmentsSection } from '@/features/projects/contracts/workspace/sections/AmendmentsSection';

const contract: ContractWithDetails = {
  id: 'contract-1',
  projectId: 'project-1',
  vendorName: 'Dodavatel',
  title: 'Smlouva',
  status: 'active',
  currency: 'CZK',
  basePrice: 100,
  source: 'manual',
  amendments: [
    {
      id: 'amendment-1',
      contractId: 'contract-1',
      amendmentNo: 1,
      deltaPrice: 10,
      documentStoragePath: 'projects/project-1/contracts/amendment.pdf',
    },
  ],
  drawdowns: [],
  invoices: [],
  currentTotal: 110,
  approvedSum: 0,
  remaining: 110,
  invoicedSum: 0,
  paidSum: 0,
  overdueSum: 0,
};

describe('AmendmentsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteAmendment.mockResolvedValue(undefined);
    mocks.deleteAmendmentDocument.mockResolvedValue(undefined);
  });

  it('po smazání dodatku uklidí jeho uložený dokument', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onRefresh = vi.fn();
    render(<AmendmentsSection contract={contract} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByTitle('Smazat'));

    await waitFor(() => {
      expect(mocks.deleteAmendment).toHaveBeenCalledWith('amendment-1');
      expect(mocks.deleteAmendmentDocument).toHaveBeenCalledWith(
        'projects/project-1/contracts/amendment.pdf',
      );
      expect(onRefresh).toHaveBeenCalled();
    });
    confirm.mockRestore();
  });
});
