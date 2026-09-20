import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BudgetTenderCatalog } from '@features/projects/budget/ui/BudgetTenderCatalog';
import { budgetApi } from '@features/projects/budget/api/budgetApi';
vi.mock('@features/projects/budget/api/budgetApi', () => ({ budgetApi: { projectTenders: vi.fn(), personalTenders: vi.fn(), saveProjectTenders: vi.fn() } }));
const definitions = [{ id: 'd1', title: 'Zemní práce', externalCode: '01' }];
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(budgetApi.projectTenders).mockResolvedValue(definitions);
  vi.mocked(budgetApi.personalTenders).mockResolvedValue({ version: 3, definitions });
  vi.mocked(budgetApi.saveProjectTenders).mockResolvedValue(undefined);
});
afterEach(cleanup);
const setup = (readOnly = false) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BudgetTenderCatalog projectId="p" userId="u" readOnly={readOnly} onTemplates={vi.fn()}/></QueryClientProvider>);
it('saves a personal default with its original concurrency version without changing project tenders', async () => {
  setup(); fireEvent.click(screen.getByRole('tab', { name: 'Moje výchozí VŘ' }));
  fireEvent.change(await screen.findByLabelText('Název VŘ 1'), { target: { value: 'Základy' } });
  expect(screen.getByRole('tab', { name: 'VŘ této stavby' })).toBeDisabled();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Uložit číselník' })); });
  expect(budgetApi.personalTenders).toHaveBeenLastCalledWith([{ ...definitions[0], title: 'Základy' }], 3);
  expect(budgetApi.saveProjectTenders).not.toHaveBeenCalled();
});
it('keeps project identifiers and blocks duplicate codes without deleting existing tender links', async () => {
  setup(); await screen.findByDisplayValue('Zemní práce');
  expect(screen.queryByRole('button', { name: 'Odstranit VŘ 1 z číselníku' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Přidat VŘ' }));
  fireEvent.change(screen.getByLabelText('Název VŘ 2'), { target: { value: 'Beton' } });
  fireEvent.change(screen.getByLabelText('Číslo VŘ 2'), { target: { value: '01' } });
  expect(screen.getByRole('button', { name: 'Uložit číselník' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Číslo VŘ 2'), { target: { value: '02' } });
  fireEvent.click(screen.getByRole('button', { name: 'Uložit číselník' }));
  await waitFor(() => expect(budgetApi.saveProjectTenders).toHaveBeenCalledWith('p', definitions, [definitions[0], expect.objectContaining({ title: 'Beton', externalCode: '02' })]));
});
it('prevents project edits when locked and keeps independent personal defaults editable', async () => {
  setup(true); expect(await screen.findByLabelText('Název VŘ 1')).toBeDisabled();
  fireEvent.click(screen.getByRole('tab', { name: 'Moje výchozí VŘ' }));
  await waitFor(() => expect(screen.getByLabelText('Název VŘ 1')).not.toBeDisabled());
});
it('sets the current project catalog as the personal default after showing the replacement', async () => {
  setup(); await screen.findByDisplayValue('Zemní práce');
  fireEvent.click(screen.getByRole('button', { name: 'Nastavit jako výchozí', exact: true }));
  expect(await screen.findByRole('dialog', { name: 'Nastavit číselník jako výchozí' })).toBeVisible();
  expect(budgetApi.personalTenders).not.toHaveBeenCalledWith(expect.any(Array), expect.any(Number));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Potvrdit výchozí číselník' })); });
  expect(budgetApi.personalTenders).toHaveBeenLastCalledWith(definitions, 3);
  expect(budgetApi.saveProjectTenders).not.toHaveBeenCalled();
});
