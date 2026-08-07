import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractWithDetails } from '@/types';
import { ContractsTable } from '@/features/projects/contracts/list/ContractsTable';

const contract: ContractWithDetails = {
  id: 'contract-1',
  projectId: 'project-1',
  vendorName: 'Dodavatel',
  title: 'Velmi dlouhý název smlouvy bez omezení délky',
  contractNumber: 'SOD-2026-001-EXTRA-DLOUHE-CISLO',
  status: 'draft',
  currency: 'CZK',
  basePrice: 100,
  source: 'manual',
  documentStoragePath: 'projects/project-1/contracts/file.pdf',
  documentFileName: 'smlouva.pdf',
  documentMimeType: 'application/pdf',
  amendments: [],
  drawdowns: [],
  invoices: [],
  currentTotal: 100,
  approvedSum: 0,
  remaining: 100,
  invoicedSum: 0,
  paidSum: 0,
  overdueSum: 0,
};

describe('ContractsTable', () => {
  beforeEach(() => localStorage.clear());

  it('zalomí číslo a název, otevře PDF bez výběru řádku a zobrazí ikonu typu', () => {
    const onSelect = vi.fn();
    const onOpenDocument = vi.fn();
    render(
      <ContractsTable
        contracts={[contract]}
        onSelect={onSelect}
        onOpenDocument={onOpenDocument}
      />,
    );

    const numberCell = screen.getByText(contract.contractNumber!).closest('td');
    expect(numberCell).toHaveClass('whitespace-normal');
    expect(numberCell?.className).toContain('[overflow-wrap:anywhere]');
    fireEvent.click(screen.getByRole('button', { name: /Otevřít dokument/ }));
    expect(onOpenDocument).toHaveBeenCalledWith(contract);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('mění šířku tažením a uloží ji do verzovaných preferencí', async () => {
    render(<ContractsTable contracts={[contract]} onSelect={vi.fn()} />);
    const separator = screen.getByRole('separator', { name: 'Změnit šířku sloupce Č. smlouvy' });
    fireEvent(separator, new MouseEvent('pointerdown', { bubbles: true, clientX: 100 }));
    fireEvent(window, new MouseEvent('pointermove', { bubbles: true, clientX: 250 }));
    fireEvent(window, new MouseEvent('pointerup', { bubbles: true }));

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('tf.contracts.tableColumns.v2') || '{}');
      expect(saved.widths.number).toBe(430);
    });
  });
});
