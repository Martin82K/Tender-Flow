import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BidContractLinks } from '@/features/projects/contracts/ui/BidContractLinks';
import type { Bid, ContractWithDetails } from '@/types';

const bid = { id: 'b1', companyName: 'Dodavatel', status: 'sod' } as Bid;
const contract = (id: string, sourceBidId?: string, projectId = 'p1') => ({
  id, sourceBidId, projectId, title: `Smlouva ${id}`, vendorName: 'Dodavatel',
} as ContractWithDetails);

describe('BidContractLinks', () => {
  it('lets the user search full contract text and inspect the selection before confirming', () => {
    const link = vi.fn();
    const record = { ...contract('long'), title: 'Objednávka na opravu mostního objektu a navazující stavební práce', vendorName: 'Silniční stavby Test', contractNumber: 'JR/01/26026/2026' };
    render(<BidContractLinks projectId="p1" bid={bid} contracts={[record, contract('other')]} onOpenContract={vi.fn()} onLinkContract={link} />);
    fireEvent.click(screen.getByRole('button', { name: 'Propojit existující smlouvu' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Existující smlouva' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'JR/01/26026' } });
    const option = screen.getByRole('option', { name: /Objednávka na opravu/ });
    expect(option.querySelector('span')).not.toHaveClass('truncate');
    fireEvent.click(option);
    const preview = screen.getByRole('region', { name: 'Vybraná smlouva' });
    expect(within(preview).getByText(record.title)).toBeVisible();
    expect(preview).toHaveTextContent(record.vendorName);
    expect(preview).toHaveTextContent(record.contractNumber);
    expect(link).not.toHaveBeenCalled();
  });

  it('hides linking after the contract is linked', () => {
    const props = { projectId: 'p1', bid, onOpenContract: vi.fn(), onLinkContract: vi.fn() };
    const { rerender } = render(<BidContractLinks {...props} contracts={[contract('c1')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Propojit existující smlouvu' }));
    rerender(<BidContractLinks {...props} contracts={[contract('c1', 'b1')]} />);
    expect(screen.getByRole('button', { name: 'Otevřít ve Smlouvách' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Propojit existující smlouvu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Existující smlouva' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Potvrdit propojení' })).not.toBeInTheDocument();
  });

  it('opens the explicitly linked record without changing the bid', () => {
    const open = vi.fn();
    render(<BidContractLinks projectId="p1" bid={bid} contracts={[contract('c1', 'b1')]} onOpenContract={open} />);
    fireEvent.click(screen.getByRole('button', { name: 'Otevřít ve Smlouvách' }));
    expect(open).toHaveBeenCalledWith('c1');
  });

  it('requires a choice when multiple records are linked and excludes another project', () => {
    const open = vi.fn();
    render(<BidContractLinks projectId="p1" bid={bid} contracts={[contract('c1', 'b1'), contract('c2', 'b1'), contract('private', 'b1', 'p2')]} onOpenContract={open} />);
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByText('Smlouva private')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Propojená smlouva' }), { target: { value: 'c2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Otevřít ve Smlouvách' }));
    expect(open).toHaveBeenCalledWith('c2');
  });

  it('links only after explicit confirmation, hides already assigned records and reports failure', async () => {
    const link = vi.fn().mockRejectedValue(new Error('Vazba se změnila. Obnovte seznam.'));
    const open = vi.fn();
    render(<BidContractLinks projectId="p1" bid={bid} contracts={[contract('c1'), contract('assigned', 'other')]} onOpenContract={open} onLinkContract={link} />);
    fireEvent.click(screen.getByRole('button', { name: 'Propojit existující smlouvu' }));
    expect(screen.queryByText('Smlouva assigned')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Existující smlouva' }), { target: { value: 'c1' } });
    expect(link).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Potvrdit propojení' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Vazba se změnila'));
    expect(link).toHaveBeenCalledWith('c1', 'b1');
    expect(open).not.toHaveBeenCalled();
  });
});
