import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConstructionBudget } from '@features/projects/budget/ui/ConstructionBudget';
import { budgetApi } from '@features/projects/budget/api/budgetApi';
import type { BudgetRevision, BudgetSource } from '@features/projects/budget/model/types';

vi.mock('@features/projects/budget/api/budgetApi', () => ({ budgetApi: { index: vi.fn(), revision: vi.fn(), sources: vi.fn(), history: vi.fn().mockResolvedValue([]) } }));
vi.mock('@features/projects/budget/ui/BudgetImportDialog', () => ({ BudgetImportDialog: ({ source }: { source: BudgetSource }) => <div role="dialog">Oprava {source.id}</div> }));
const revision = { id: 'r', source_id: 's', title: 'Rozpočet', version: 1, status: 'draft', allocations: [], document: { schemaVersion: 1, figures: {}, nodes: [], sheets: [], issues: [] } } as unknown as BudgetRevision;
const source = { id: 's', project_id: 'p', filename: 'rozpocet.xlsx', status: 'ready', created_at: '2026-09-25T08:00:00Z' } as BudgetSource;
const permissions = { read: true, prices: true, edit: true, confirm: true, allocate: true };
let client: QueryClient;

beforeEach(() => {
  localStorage.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300_000 } } });
  vi.mocked(budgetApi.index).mockResolvedValue({ revisions: [revision], permissions });
  vi.mocked(budgetApi.revision).mockResolvedValue(revision);
  vi.mocked(budgetApi.sources).mockResolvedValue([source]);
});
afterEach(() => { cleanup(); client.clear(); vi.clearAllMocks(); });
async function openBudget() {
  render(<QueryClientProvider client={client}><ConstructionBudget projectId="p" userId="u" categories={[]}/></QueryClientProvider>);
  await screen.findByRole('button', { name: 'Akce rozpočtu' });
}
function openRepair() {
  fireEvent.click(screen.getByRole('button', { name: 'Akce rozpočtu' }));
  fireEvent.click(screen.getByRole('button', { name: 'Opravit import' }));
}

it('does not load sources for items or recap, loads them for versions, and reuses cached sources', async () => {
  await openBudget();
  expect(budgetApi.sources).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Rekapitulace', exact: true }));
  expect(budgetApi.sources).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Importy a verze', exact: true }));
  expect(await screen.findByText('rozpocet.xlsx')).toBeVisible();
  expect(budgetApi.sources).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Položky', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Importy a verze', exact: true }));
  expect(budgetApi.sources).toHaveBeenCalledTimes(1);
});

it('waits for source metadata before mounting the repair editor', async () => {
  let resolve!: (sources: BudgetSource[]) => void;
  vi.mocked(budgetApi.sources).mockReturnValue(new Promise(done => { resolve = done; }));
  await openBudget();
  openRepair();
  expect(await screen.findByText('Načítání příloh rozpočtu…')).toBeVisible();
  expect(screen.queryByText('Oprava s')).not.toBeInTheDocument();
  await act(async () => resolve([source]));
  expect(await screen.findByText('Oprava s')).toBeVisible();
});

it('shows a source error and retries without opening an editor with missing data', async () => {
  vi.mocked(budgetApi.sources).mockRejectedValueOnce(new Error('Přílohy jsou dočasně nedostupné.'));
  await openBudget();
  openRepair();
  expect(await screen.findByText('Přílohy jsou dočasně nedostupné.')).toBeVisible();
  expect(screen.queryByText('Oprava s')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
  expect(await screen.findByText('Oprava s')).toBeVisible();
  expect(budgetApi.sources).toHaveBeenCalledTimes(2);
});

it('does not interpret loading source metadata as an empty source list', async () => {
  vi.mocked(budgetApi.sources).mockReturnValue(new Promise(() => {}));
  await openBudget();
  fireEvent.click(screen.getByRole('button', { name: 'Importy a verze', exact: true }));
  expect(await screen.findByText('Načítání příloh rozpočtu…')).toBeVisible();
  expect(screen.queryByText('Zatím žádné přílohy.')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Koš/ })).not.toBeInTheDocument();
});

it('keeps a missing source out of the repair editor', async () => {
  vi.mocked(budgetApi.sources).mockResolvedValue([]);
  await openBudget();
  openRepair();
  expect(await screen.findByText('Původní příloha není dostupná. Zkontrolujte Importy a verze.')).toBeVisible();
  expect(screen.queryByText('Oprava s')).not.toBeInTheDocument();
});

it('does not reopen repair after the user closes it during source loading', async () => {
  let resolve!: (sources: BudgetSource[]) => void;
  vi.mocked(budgetApi.sources).mockReturnValue(new Promise(done => { resolve = done; }));
  await openBudget();
  openRepair();
  await screen.findByText('Načítání příloh rozpočtu…');
  fireEvent.click(screen.getByRole('button', { name: /Zavřít/ }));
  await act(async () => resolve([source]));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('preserves an open editor during a failed background source refresh', async () => {
  await openBudget();
  openRepair();
  await screen.findByText('Oprava s');
  vi.mocked(budgetApi.sources).mockRejectedValueOnce(new Error('Obnova příloh selhala.'));
  await act(async () => { await client.invalidateQueries({ queryKey: ['construction-budget', 'p', 'u', 'sources'] }); });
  expect(screen.getByText('Oprava s')).toBeVisible();
  expect(await screen.findByText('Obnova příloh selhala.')).toBeVisible();
});

it('does not load sources or expose repair when the budget is read only', async () => {
  vi.mocked(budgetApi.index).mockResolvedValue({ revisions: [revision], permissions: { ...permissions, edit: false } });
  await openBudget();
  fireEvent.click(screen.getByRole('button', { name: 'Akce rozpočtu' }));
  expect(screen.queryByRole('button', { name: 'Opravit import' })).not.toBeInTheDocument();
  await waitFor(() => expect(budgetApi.revision).toHaveBeenCalled());
  expect(budgetApi.sources).not.toHaveBeenCalled();
});
