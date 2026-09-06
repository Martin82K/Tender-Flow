import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractWithDetails } from '@/types';
import { navigate, useLocation } from '@shared/routing/router';

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
vi.mock('@/features/projects/contracts/investor/InvestorBillingPage', () => ({ InvestorBillingPage: () => <div>Investor obsah</div> }));
vi.mock('@/features/projects/contracts/dashboard/ContractsDashboard', () => ({ ContractsDashboard: () => <div>Dashboard obsah</div> }));
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

it.each(['Investor', 'Dashboard'])('přepne %s na konkrétní detail při novém deep linku', async (tab) => {
  const { rerender } = render(<ContractsModule projectId="project-1" onUpdateDetails={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(tab) }));
  expect(screen.getByText(`${tab} obsah`)).toBeInTheDocument();
  rerender(<ContractsModule projectId="project-1" initialContractId="contract-1" onUpdateDetails={vi.fn()} />);
  await waitFor(() => expect(screen.getByTestId('workspace')).toHaveTextContent('contract-1'));
  expect(screen.queryByText(`${tab} obsah`)).not.toBeInTheDocument();
});

it('po přepnutí Investor spotřebuje odkaz a dovolí nové hledání stejné smlouvy', async () => {
  const url = '/app/project/project-1?tab=contracts&contractId=contract-1&categoryId=keep';
  window.history.replaceState({}, '', url);
  const Harness = () => {
    const { search } = useLocation();
    return <ContractsModule projectId="project-1" initialContractId={new URLSearchParams(search).get('contractId') ?? undefined} onUpdateDetails={vi.fn()} />;
  };
  const { unmount } = render(<Harness />);
  try {
    expect(screen.getByTestId('workspace')).toHaveTextContent('contract-1');
    fireEvent.click(screen.getByRole('button', { name: /Investor/ }));
    expect(screen.getByText('Investor obsah')).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('contractId')).toBeNull();
    expect(new URLSearchParams(window.location.search).get('categoryId')).toBe('keep');
    act(() => navigate(url));
    await waitFor(() => expect(screen.getByTestId('workspace')).toHaveTextContent('contract-1'));
  } finally {
    unmount();
    window.history.replaceState({}, '', '/');
  }
});
