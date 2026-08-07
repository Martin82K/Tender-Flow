import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractWithDetails } from '@/types';

const contract: ContractWithDetails = {
  id: 'contract-1',
  projectId: 'project-1',
  vendorName: 'Dodavatel',
  title: 'Dlouhý název smlouvy',
  contractNumber: 'SOD-2026-001',
  status: 'draft',
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

vi.mock('@/features/projects/contracts/hooks/useContractsWithDetails', () => ({
  useContractsWithDetails: () => ({
    contracts: [contract],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));
vi.mock('@/features/projects/contracts/list/ContractsHeadline', () => ({
  ContractsHeadline: () => <div data-testid="headline" />,
}));
vi.mock('@/features/projects/contracts/list/ContractListPanel', () => ({
  ContractListPanel: () => <div data-testid="list-panel" />,
}));
vi.mock('@/features/projects/contracts/workspace/ContractWorkspace', () => ({
  ContractWorkspace: () => <div data-testid="workspace" />,
}));
vi.mock('@/features/projects/contracts/forms/ContractEditDialog', () => ({
  ContractEditDialog: () => <div />,
}));

import { ContractsModule } from '@/features/projects/contracts/ContractsModule';

describe('ContractsModule navigation', () => {
  beforeEach(() => localStorage.clear());

  it('vstupuje do Smluv v tabulce a kliknutí na záložku Smlouvy tabulku obnoví', () => {
    render(
      <ContractsModule
        projectId="project-1"
        onUpdateDetails={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Tabulka/ })).toHaveAttribute('data-active', 'true');
    expect(document.querySelector('[data-help-id="contracts-table"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Split/ }));
    expect(screen.getByTestId('workspace')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Smlouvy/ }));
    expect(screen.getByRole('button', { name: /Tabulka/ })).toHaveAttribute('data-active', 'true');
    expect(document.querySelector('[data-help-id="contracts-table"]')).toBeInTheDocument();
  });

  it('zobrazuje tlačítko Nová smlouva vlevo před přepínačem zobrazení', () => {
    render(<ContractsModule projectId="project-1" onUpdateDetails={vi.fn()} />);
    const create = screen.getByRole('button', { name: '+ Nová smlouva' });
    const toggle = document.querySelector('[data-help-id="contracts-view-toggle"]');
    expect(create.compareDocumentPosition(toggle!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
