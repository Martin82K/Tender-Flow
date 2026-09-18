import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ContractWithDetails } from '@/types';

const contract: ContractWithDetails = {
  id: 'contract-1',
  projectId: 'project-1',
  vendorName: 'Dodavatel',
  title: 'Smlouva bez pravého menu',
  status: 'active',
  currency: 'CZK',
  basePrice: 100,
  source: 'manual',
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

vi.mock('@/features/projects/contracts/list/StatusPill', () => ({
  StatusPill: () => <span>Aktivní</span>,
}));
vi.mock('@/features/projects/contracts/workspace/sections/HeaderSection', () => ({
  HeaderSection: () => <section data-testid="header-section" />,
}));
vi.mock('@/features/projects/contracts/workspace/sections/OcrDocumentSection', () => ({
  OcrDocumentSection: () => <section data-testid="ocr-section" />,
}));
vi.mock('@/features/projects/contracts/workspace/sections/FinancialSection', () => ({
  FinancialSection: () => <section data-testid="financial-section" />,
}));
vi.mock('@/features/projects/contracts/workspace/sections/AmendmentsSection', () => ({
  AmendmentsSection: () => <section data-testid="amendments-section" />,
}));
vi.mock('@/features/projects/contracts/workspace/sections/InvoicesSection', () => ({
  InvoicesSection: () => <section data-testid="invoices-section" />,
}));
vi.mock('@/features/projects/contracts/workspace/sections/DrawdownsSection', () => ({
  DrawdownsSection: () => <section data-testid="drawdowns-section" />,
}));
vi.mock('@/features/projects/contracts/workspace/sections/RetentionSection', () => ({
  RetentionSection: () => <section data-testid="retention-section" />,
}));
vi.mock('@/features/projects/contracts/workspace/sections/WarrantySection', () => ({
  WarrantySection: () => <section data-testid="warranty-section" />,
}));

vi.mock('@/features/projects/contracts/documents/GeneratedDocumentsSection', () => ({ GeneratedDocumentsSection: () => <section data-testid="generated-section" /> }));
vi.mock('@/features/projects/contracts/documents/HandoverSection', () => ({ HandoverSection: () => <section data-testid="handover-section" /> }));

import { ContractWorkspace } from '@/features/projects/contracts/workspace/ContractWorkspace';

describe('ContractWorkspace layout', () => {
  const originalScrollTo = HTMLElement.prototype.scrollTo;

  beforeAll(() => {
    HTMLElement.prototype.scrollTo = vi.fn();
  });

  afterAll(() => {
    HTMLElement.prototype.scrollTo = originalScrollTo;
  });

  it('returns to the exact source card without editing the record', () => {
    const open = vi.fn();
    const edit = vi.fn();
    render(<ContractWorkspace contract={contract} onEditContract={edit} onRefresh={vi.fn()}
      sourceBid={{ categoryId: 'cat', bidId: 'bid', title: 'VŘ' }} onOpenSourceBid={open} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zpět na kartu ve VŘ' }));
    expect(open).toHaveBeenCalledWith('cat', 'bid');
    expect(edit).not.toHaveBeenCalled();
  });

  it('přepíná schválené záložky a zachovává hlavičku smlouvy', () => {
    render(
      <ContractWorkspace
        contract={contract}
        onEditContract={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(document.querySelector('[data-help-id="contract-detail-rail"]')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '✎ Upravit záznam' })).toHaveClass('bg-primary', 'text-white');
    expect(screen.getAllByTestId(/-section$/)).toHaveLength(3);
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    fireEvent.click(screen.getByRole('tab', {name:'Dokumenty'}));
    expect(screen.getByTestId('ocr-section')).toBeInTheDocument();
    expect(screen.getByRole('button', {name:'Otevřít předávací protokoly'})).toBeInTheDocument();
    expect(screen.queryByTestId('generated-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('invoices-section')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('tab', {name:'Dokumenty'}), {key:'ArrowRight'});
    expect(screen.getByTestId('invoices-section')).toBeInTheDocument();
    expect(screen.getByText(contract.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', {name:'Předání a záruka'}));
    expect(screen.getByTestId('handover-section')).toBeInTheDocument();
  });
});
