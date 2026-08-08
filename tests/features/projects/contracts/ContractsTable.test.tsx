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

  it('zobrazuje dodavatele před číslem smlouvy a dokumentem', () => {
    render(<ContractsTable contracts={[contract]} onSelect={vi.fn()} />);

    const headings = screen.getAllByRole('columnheader').map((heading) => heading.textContent);
    expect(headings.slice(0, 3)).toEqual(['Dodavatel', 'Č. smlouvy', 'Dokument']);
  });

  it('umožní připojit dokument ke smlouvě bez dokumentu a nevybere řádek', () => {
    const onSelect = vi.fn();
    const onAttachDocument = vi.fn();
    const contractWithoutDocument = {
      ...contract,
      documentStoragePath: undefined,
      documentFileName: undefined,
      documentMimeType: undefined,
    };
    render(
      <ContractsTable
        contracts={[contractWithoutDocument]}
        onSelect={onSelect}
        onAttachDocument={onAttachDocument}
      />,
    );

    const file = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])],
      'smlouva.pdf',
      { type: 'application/pdf' },
    );
    const input = screen.getByLabelText(`Připojit dokument ke smlouvě ${contract.title}`);
    fireEvent.change(input, { target: { files: [file] } });

    expect(onAttachDocument).toHaveBeenCalledWith(contractWithoutDocument, file);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('rozbalí dodatky pod jejich smlouvou bez otevření detailu smlouvy', () => {
    const onSelect = vi.fn();
    const contractWithAmendment: ContractWithDetails = {
      ...contract,
      amendments: [
        {
          id: 'amendment-1',
          contractId: contract.id,
          amendmentNo: 1,
          signedAt: '2026-04-20',
          deltaPrice: 772_282.5,
          reason: 'Vícepráce, méněpráce',
        },
      ],
    };
    render(<ContractsTable contracts={[contractWithAmendment]} onSelect={onSelect} />);

    fireEvent.click(
      screen.getByRole('button', { name: `Rozbalit dodatky smlouvy ${contract.title}` }),
    );

    expect(screen.getByText('Dodatek č. 1')).toBeInTheDocument();
    expect(screen.getByText('Vícepráce, méněpráce')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Připojit dokument k dodatku č. 1'),
    ).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

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
