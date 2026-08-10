import React from 'react';
import { render, screen } from '@testing-library/react';
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

import { ContractWorkspace } from '@/features/projects/contracts/workspace/ContractWorkspace';

describe('ContractWorkspace layout', () => {
  const originalScrollTo = HTMLElement.prototype.scrollTo;

  beforeAll(() => {
    HTMLElement.prototype.scrollTo = vi.fn();
  });

  afterAll(() => {
    HTMLElement.prototype.scrollTo = originalScrollTo;
  });

  it('vykresluje všechny sekce přes celou šířku bez pravého navigačního panelu', () => {
    render(
      <ContractWorkspace
        contract={contract}
        onEditContract={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(document.querySelector('[data-help-id="contract-detail-rail"]')).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/-section$/)).toHaveLength(8);
  });
});
