import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const exportContractTableToXlsxMock = vi.hoisted(() => vi.fn());

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: 'Martin Kalkus',
      email: 'martin@example.com',
      organizationName: 'REKO a.s.',
    },
  }),
}));
vi.mock('@/services/exportService', () => ({
  exportContractTableToXlsx: (...args: unknown[]) => exportContractTableToXlsxMock(...args),
}));
vi.mock('@/features/projects/contracts/api', () => ({
  contractQueriesApi: {
    openContractDocument: vi.fn(),
  },
}));
vi.mock('@/features/projects/contracts/utils/attachContractDocument', () => ({
  attachContractDocument: vi.fn(),
}));

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
  ContractWorkspace: ({ contract: selectedContract }: { contract: ContractWithDetails }) => (
    <div data-testid="workspace">{selectedContract.id}</div>
  ),
}));
vi.mock('@/features/projects/contracts/forms/ContractEditDialog', () => ({
  ContractEditDialog: () => <div />,
}));

import { ContractsModule } from '@/features/projects/contracts/ContractsModule';

describe('ContractsModule navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    exportContractTableToXlsxMock.mockReset();
    exportContractTableToXlsxMock.mockResolvedValue(undefined);
  });

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

  it('exportuje tabulku smluv s projektem, aplikací a přihlášeným uživatelem', async () => {
    render(
      <ContractsModule
        projectId="project-1"
        projectDetails={{ id: 'project-1', title: 'Rekonstrukce školy' }}
        onUpdateDetails={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export do Excelu' }));

    await waitFor(() => expect(exportContractTableToXlsxMock).toHaveBeenCalledTimes(1));
    expect(exportContractTableToXlsxMock).toHaveBeenCalledWith(
      [contract],
      expect.objectContaining({
        organizationName: 'REKO a.s.',
        projectName: 'Rekonstrukce školy',
        exportedBy: 'Martin Kalkus',
        appVersion: expect.stringMatching(/^\d+\.\d+\.\d+/),
      }),
    );
  });

  it('otevře deep-linkovanou smlouvu rovnou ve split detailu', () => {
    render(
      <ContractsModule
        projectId="project-1"
        initialContractId="contract-1"
        onUpdateDetails={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Split/ })).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('workspace')).toHaveTextContent('contract-1');
  });
});
