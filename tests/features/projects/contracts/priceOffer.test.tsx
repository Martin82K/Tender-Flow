import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractWithDetails } from '@/types';
import { ContractsTable } from '@/features/projects/contracts/list/ContractsTable';

const mocks = vi.hoisted(() => ({ updateContract: vi.fn() }));
vi.mock('@/features/projects/contracts/api', () => ({ contractMutationsApi: mocks, contractQueriesApi: {} }));
const contract: ContractWithDetails = {
  id: 'c', projectId: 'p', vendorName: 'Dodavatel', title: 'Smlouva',
  status: 'draft', currency: 'CZK', basePrice: 100, source: 'manual',
  documentStoragePath: 'projects/p/contracts/contract.pdf', documentFileName: 'smlouva.pdf', documentMimeType: 'application/pdf',
  amendments: [], drawdowns: [], invoices: [], currentTotal: 100,
  approvedSum: 0, remaining: 100, invoicedSum: 0, paidSum: 0, overdueSum: 0,
};
describe('mapped price offer', () => {
  beforeEach(() => { localStorage.clear(); vi.resetAllMocks(); });
  it('shows the offer between document and status and starts linking without selecting the row', () => {
    const onSelect = vi.fn();
    const onAttachPriceOffer = vi.fn();
    render(<ContractsTable contracts={[contract]} onSelect={onSelect} onAttachPriceOffer={onAttachPriceOffer} />);
    expect(screen.getAllByRole('columnheader').map(h => h.textContent).slice(2, 5)).toEqual(['Dokument', 'Cenová nabídka', 'Stav']);
    fireEvent.click(screen.getByRole('button', { name: 'Připojit cenovou nabídku Smlouva' }));
    expect(onAttachPriceOffer).toHaveBeenCalledWith(contract);
    expect(onSelect).not.toHaveBeenCalled();
  });
  it('opens the mapped file independently of the original contract document', () => {
    const onOpenPriceOffer = vi.fn(); const onSelect = vi.fn();
    const mapped = { ...contract, priceOfferPath: 'Dodavatel/Nabídka.xlsx' };
    render(<ContractsTable contracts={[mapped]} onSelect={onSelect} onOpenPriceOffer={onOpenPriceOffer} />);
    fireEvent.click(screen.getByRole('button', { name: 'Otevřít cenovou nabídku Smlouva' }));
    expect(onOpenPriceOffer).toHaveBeenCalledWith(mapped);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText('Nabídka.xlsx')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otevřít dokument smlouva.pdf' })).toBeInTheDocument();
  });
});
