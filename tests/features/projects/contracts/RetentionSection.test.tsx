import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractWithDetails } from '@/types';
const { releaseRetention } = vi.hoisted(() => ({ releaseRetention: vi.fn() }));
vi.mock('@features/projects/contracts/api', () => ({ contractMutationsApi: { releaseRetention } }));
import { RetentionSection } from '@features/projects/contracts/workspace/sections/RetentionSection';
const contract = { id: 'c1', currency: 'CZK', basePrice: 1000, currentTotal: 1200, invoicedSum: 400, paidSum: 200, approvedSum: 300 } as ContractWithDetails;
describe('retention release evidence', () => {
  beforeEach(() => { vi.clearAllMocks(); releaseRetention.mockResolvedValue(undefined); });
  it('treats empty terms as no retention and supports fixed amounts without percent', () => {
    const { rerender } = render(<RetentionSection contract={contract} onRefresh={vi.fn()} />);
    expect(screen.getAllByText('Neuplatňuje se')).toHaveLength(2);
    rerender(<RetentionSection contract={{ ...contract, retentionShortPercent: 0, retentionLongAmount: 60 }} onRefresh={vi.fn()} />);
    expect(screen.getByText('Neuplatňuje se')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Označit dlouhodobou jako uvolněnou' })).toBeInTheDocument();
  });
  it('keeps planned and actual dates distinct after release', () => {
    render(<RetentionSection contract={{ ...contract, retentionShortPercent: 5, retentionShortStatus: 'released', retentionShortExpectedOn: '2026-08-01', retentionShortReleaseOn: '2026-08-12' }} onRefresh={vi.fn()} />);
    expect(screen.getByText('1. 8. 2026')).toBeInTheDocument();
    expect(screen.getByText('12. 8. 2026')).toBeInTheDocument();
    expect(screen.getByText('Skutečné uvolnění')).toBeInTheDocument();
  });
  it('requires explicit confirmation and surfaces failure without refreshing', async () => {
    releaseRetention.mockRejectedValue(new Error('Chybí oprávnění.'));
    const refresh = vi.fn();
    render(<RetentionSection contract={{ ...contract, retentionShortPercent: 5 }} onRefresh={refresh} />);
    fireEvent.click(screen.getByRole('button', { name: 'Označit krátkodobou jako uvolněnou' }));
    expect(releaseRetention).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Potvrdit uvolnění' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Chybí oprávnění.'));
    expect(refresh).not.toHaveBeenCalled();
  });
  it('labels calculated sums and invoicing as separate evidence', () => {
    render(<RetentionSection contract={{ ...contract, retentionShortPercent: 5 }} onRefresh={vi.fn()} />);
    expect(screen.getAllByText(/z ceny smlouvy včetně dodatků/i)).toHaveLength(2);
    expect(screen.getByText(/skutečně zadržené částky z faktur/i)).toBeInTheDocument();
  });
});
