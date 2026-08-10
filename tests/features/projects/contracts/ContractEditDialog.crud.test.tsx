import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractWithDetails } from '@/types';

const mocks = vi.hoisted(() => ({
  updateContractWithDocumentChange: vi.fn(),
  deleteContractWithDocuments: vi.fn(),
}));

vi.mock('@/features/projects/contracts/utils/contractCrud', () => ({
  updateContractWithDocumentChange: mocks.updateContractWithDocumentChange,
  deleteContractWithDocuments: mocks.deleteContractWithDocuments,
}));

vi.mock('@/shared/contracts/MarkdownDocumentPanel', () => ({
  MarkdownDocumentPanel: () => <div data-testid="markdown-panel" />,
}));

const contract = {
  id: 'contract-1',
  projectId: 'project-1',
  vendorName: 'Dodavatel s.r.o.',
  title: 'SOD',
  status: 'active',
  currency: 'CZK',
  basePrice: 100,
  source: 'manual',
  documentStoragePath: 'projects/project-1/contracts/current.pdf',
  documentFileName: 'current.pdf',
  amendments: [],
  drawdowns: [],
  invoices: [],
  currentTotal: 100,
  approvedSum: 0,
  remaining: 100,
  invoicedSum: 0,
  paidSum: 0,
  overdueSum: 0,
} satisfies ContractWithDetails;

import { ContractEditDialog } from '@/features/projects/contracts/forms/ContractEditDialog';

describe('ContractEditDialog CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateContractWithDocumentChange.mockResolvedValue({ cleanupWarning: null });
    mocks.deleteContractWithDocuments.mockResolvedValue({ cleanupWarning: null });
  });

  it('umožní nahradit nebo odpojit existující přílohu', async () => {
    const onSaved = vi.fn();
    render(
      <ContractEditDialog
        projectId="project-1"
        contract={contract}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    expect(screen.getByText('current.pdf')).toBeInTheDocument();
    expect(screen.getByLabelText('Nahradit přílohu smlouvy')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Odpojit a smazat přílohu' }));
    expect(screen.getByText(/příloha odpojena a odstraněna/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));

    await waitFor(() =>
      expect(mocks.updateContractWithDocumentChange).toHaveBeenCalledWith(
        expect.objectContaining({
          contract,
          replacementFile: null,
          removeDocument: true,
        }),
      ),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('smaže smlouvu až po explicitním potvrzení', async () => {
    const onDeleted = vi.fn();
    render(
      <ContractEditDialog
        projectId="project-1"
        contract={contract}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onDeleted={onDeleted}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Smazat smlouvu' }));
    expect(screen.getByText('Smazat smlouvu?')).toBeInTheDocument();
    expect(mocks.deleteContractWithDocuments).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Smazat', exact: true }));

    await waitFor(() => expect(mocks.deleteContractWithDocuments).toHaveBeenCalledWith(contract));
    expect(onDeleted).toHaveBeenCalled();
  });
});
