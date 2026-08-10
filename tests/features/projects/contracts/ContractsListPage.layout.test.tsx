import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ContractWithDetails } from '@/types';

const makeContract = (
  id: string,
  title: string,
  status: ContractWithDetails['status'],
): ContractWithDetails => ({
  id,
  projectId: 'project-1',
  vendorName: `${title} dodavatel`,
  title,
  contractNumber: `SOD-${id}`,
  status,
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
});

const contracts = [
  makeContract('alpha', 'Aktivní smlouva', 'active'),
  makeContract('beta', 'Uzavřená smlouva', 'closed'),
];

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock('@/services/exportService', () => ({
  exportContractTableToXlsx: vi.fn(),
}));
vi.mock('@/features/projects/contracts/api', () => ({
  contractQueriesApi: { openContractDocument: vi.fn() },
}));
vi.mock('@/features/projects/contracts/utils/attachContractDocument', () => ({
  attachContractDocument: vi.fn(),
}));
vi.mock('@/features/projects/contracts/list/ContractsHeadline', () => ({
  ContractsHeadline: () => <div data-testid="headline" />,
}));
vi.mock('@/features/projects/contracts/workspace/ContractWorkspace', () => ({
  ContractWorkspace: ({ contract }: { contract: ContractWithDetails }) => (
    <div data-testid="workspace">{contract.title}</div>
  ),
}));
vi.mock('@/features/projects/contracts/forms/ContractEditDialog', () => ({
  ContractEditDialog: () => null,
}));

import { ContractsListPage } from '@/features/projects/contracts/list/ContractsListPage';

describe('ContractsListPage layout', () => {
  it('umísťuje hledání a filtry do horní lišty a filtruje levý seznam', () => {
    render(
      <ContractsListPage
        projectId="project-1"
        contracts={contracts}
        refresh={vi.fn()}
        viewMode="split"
        onViewModeChange={vi.fn()}
      />,
    );

    const toolbar = document.querySelector('[data-help-id="contracts-list-toolbar"]');
    const listRail = document.querySelector('[data-help-id="contracts-list-rail"]');
    const search = screen.getByRole('searchbox', { name: 'Hledat smlouvu nebo dodavatele' });

    expect(toolbar).toContainElement(search);
    expect(listRail).not.toContainElement(search);
    expect(within(listRail as HTMLElement).getByText('Aktivní smlouva')).toBeInTheDocument();
    expect(within(listRail as HTMLElement).getByText('Uzavřená smlouva')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'Uzavřená' } });
    expect(within(listRail as HTMLElement).queryByText('Aktivní smlouva')).not.toBeInTheDocument();
    expect(within(listRail as HTMLElement).getByText('Uzavřená smlouva')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aktivní' }));
    expect(within(listRail as HTMLElement).getByText('Aktivní smlouva')).toBeInTheDocument();
    expect(within(listRail as HTMLElement).queryByText('Uzavřená smlouva')).not.toBeInTheDocument();
  });

  it('nezobrazuje splitové hledání a filtry v tabulkovém režimu', () => {
    render(
      <ContractsListPage
        projectId="project-1"
        contracts={contracts}
        refresh={vi.fn()}
        viewMode="table"
        onViewModeChange={vi.fn()}
      />,
    );

    expect(document.querySelector('[data-help-id="contracts-list-toolbar"]')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('searchbox', { name: 'Hledat smlouvu nebo dodavatele' }),
    ).not.toBeInTheDocument();
  });
});
