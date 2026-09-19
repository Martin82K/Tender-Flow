import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConstructionBudget } from '@features/projects/budget/ui/ConstructionBudget';
import { budgetApi } from '@features/projects/budget/api/budgetApi';
import type { BudgetRevision } from '@features/projects/budget/model/types';

vi.mock('@features/projects/budget/api/budgetApi', () => ({ budgetApi: { index: vi.fn(), sources: vi.fn(), revision: vi.fn() } }));
const revision = { id: 'r', title: 'Rozpočet', version: 1, status: 'draft', allocations: [], document: { schemaVersion: 1, figures: {}, nodes: [], sheets: [], issues: [] } } as unknown as BudgetRevision;
beforeEach(() => {
  localStorage.clear();
  vi.mocked(budgetApi.index).mockResolvedValue({ revisions: [revision], permissions: { prices: true, edit: false, confirm: false, allocate: false } });
  vi.mocked(budgetApi.sources).mockResolvedValue([]);
  vi.mocked(budgetApi.revision).mockResolvedValue(revision);
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });
async function openBudget() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ConstructionBudget projectId="p" userId="u" categories={[]}/></QueryClientProvider>);
  return screen.findByRole('button', { name: 'Nastavení zobrazení' });
}
it('keeps view controls under settings and preserves their saved values', async () => {
  const trigger = await openBudget();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('checkbox', { name: 'Zalamovat' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Sloupce' })).not.toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Výkaz výměr' })).toBeVisible();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Zalamovat' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pohodlná' }));
  await waitFor(() => expect(JSON.parse(localStorage.getItem('tf-budget-view:u:p')!)).toMatchObject({ wrap: true, density: 60 }));
  fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Zalamovat' }), { key: 'Escape' });
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger);
  expect(screen.getByRole('checkbox', { name: 'Zalamovat' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Pohodlná' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.pointerDown(document.body);
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
it('opens column configuration from settings and restores focus to the settings button', async () => {
  const trigger = await openBudget();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: 'Sloupce' }));
  expect(screen.getByRole('dialog', { name: 'Nastavení sloupců' })).toBeVisible();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByRole('checkbox', { name: 'MJ', exact: true }));
  await waitFor(() => expect(JSON.parse(localStorage.getItem('tf-budget-view:u:p')!).columns.find((column: { key: string }) => column.key === 'unit').hidden).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: 'Zavřít dialog' }));
  expect(trigger).toHaveFocus();
});
