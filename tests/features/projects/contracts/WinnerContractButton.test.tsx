import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WinnerContractButton } from '@/features/projects/contracts/ui/WinnerContractButton';
import type { Bid, ContractWithDetails } from '@/types';

const winner: Bid = {
  id: 'bid-1',
  subcontractorId: 'vendor-1',
  companyName: 'Dodavatel 1',
  contactPerson: 'Jan Novák',
  email: 'jan@example.com',
  phone: '',
  price: '100 000 Kč',
  status: 'sod',
  contracted: true,
};

const linkedContract: ContractWithDetails = {
  id: 'contract-1',
  projectId: 'project-1',
  vendorId: 'vendor-1',
  vendorName: 'Dodavatel 1',
  title: 'SOD Dodavatel 1',
  status: 'active',
  currency: 'CZK',
  basePrice: 100_000,
  source: 'from_tender_winner',
  sourceBidId: 'bid-1',
  amendments: [],
  drawdowns: [],
  invoices: [],
  currentTotal: 100_000,
  approvedSum: 0,
  remaining: 100_000,
  invoicedSum: 0,
  paidSum: 0,
  overdueSum: 0,
};

describe('WinnerContractButton', () => {
  it('otevře navázanou smlouvu a nemění contracted příznak', () => {
    const onOpenContract = vi.fn();
    const onToggleContracted = vi.fn();
    render(
      <WinnerContractButton
        bid={winner}
        contracts={[linkedContract]}
        onOpenContract={onOpenContract}
        onToggleContracted={onToggleContracted}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Otevřít smlouvu SOD Dodavatel 1/ }));

    expect(onOpenContract).toHaveBeenCalledWith('contract-1');
    expect(onToggleContracted).not.toHaveBeenCalled();
  });

  it('zachová původní označení jako zasmluvněno bez skutečné smlouvy', () => {
    const onToggleContracted = vi.fn();
    render(
      <WinnerContractButton
        bid={{ ...winner, contracted: false }}
        contracts={[]}
        onOpenContract={vi.fn()}
        onToggleContracted={onToggleContracted}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Označit jako zasmluvněno' }));
    expect(onToggleContracted).toHaveBeenCalledWith(expect.objectContaining({ id: 'bid-1' }));
  });

  it('u nejednoznačné historické vazby neotevře náhodnou smlouvu', () => {
    render(
      <WinnerContractButton
        bid={winner}
        contracts={[
          { ...linkedContract, id: 'contract-1', sourceBidId: undefined },
          { ...linkedContract, id: 'contract-2', sourceBidId: undefined },
        ]}
        onOpenContract={vi.fn()}
        onToggleContracted={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Více smluv odpovídá tomuto vítězi' })).toBeDisabled();
  });

  it('během načítání nepřepne contracted místo otevření smlouvy', () => {
    const onToggleContracted = vi.fn();
    render(
      <WinnerContractButton
        bid={winner}
        contracts={[]}
        loading
        onOpenContract={vi.fn()}
        onToggleContracted={onToggleContracted}
      />,
    );

    const button = screen.getByRole('button', { name: 'Načítám smlouvu vítěze' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onToggleContracted).not.toHaveBeenCalled();
  });
});
