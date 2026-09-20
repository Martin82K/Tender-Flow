import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConstructionBudget } from '@features/projects/budget/ui/ConstructionBudget';
import { budgetApi } from '@features/projects/budget/api/budgetApi';
import type { BudgetRevision } from '@features/projects/budget/model/types';

vi.mock('@features/projects/budget/api/budgetApi', () => ({ budgetApi: { index: vi.fn(), sources: vi.fn(), revision: vi.fn(), setPrimary: vi.fn(), save: vi.fn() } }));
const revision = { id: 'r', title: 'Rozpočet', version: 1, status: 'draft', allocations: [], document: { schemaVersion: 1, figures: {}, nodes: [], sheets: [], issues: [] } } as unknown as BudgetRevision;
beforeEach(() => {
  localStorage.clear();
  vi.mocked(budgetApi.index).mockResolvedValue({ revisions: [revision], permissions: { prices: true, edit: false, confirm: false, allocate: false } });
  vi.mocked(budgetApi.sources).mockResolvedValue([]);
  vi.mocked(budgetApi.revision).mockResolvedValue(revision);
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });
async function openBudget(canUseTenders=false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ConstructionBudget projectId="p" userId="u" categories={[]} canUseTenders={canUseTenders}/></QueryClientProvider>);
  return screen.findByRole('button', { name: 'Nastavení zobrazení' });
}
it('toggles cell grid lines and restores the saved preference after reopening', async () => {
  fireEvent.click(await openBudget());
  const grid = screen.getByRole('checkbox', { name: 'Zobrazit mřížku' });
  expect(grid).not.toBeChecked();
  expect(screen.getByRole('region', { name: 'Rozpočet stavby' })).not.toHaveClass('tf-budget-show-grid');
  fireEvent.click(grid);
  expect(screen.getByRole('region', { name: 'Rozpočet stavby' })).toHaveClass('tf-budget-show-grid');
  await waitFor(() => expect(JSON.parse(localStorage.getItem('tf-budget-view:u:p')!)).toMatchObject({ grid: true }));
  cleanup();
  fireEvent.click(await openBudget());
  expect(screen.getByRole('checkbox', { name: 'Zobrazit mřížku' })).toBeChecked();
  expect(screen.getByRole('region', { name: 'Rozpočet stavby' })).toHaveClass('tf-budget-show-grid');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Zobrazit mřížku' }));
  expect(screen.getByRole('region', { name: 'Rozpočet stavby' })).not.toHaveClass('tf-budget-show-grid');
  await waitFor(() => expect(JSON.parse(localStorage.getItem('tf-budget-view:u:p')!)).toMatchObject({ grid: false }));
});
it('defaults the grid off for older saved settings while retaining other preferences', async () => {
  localStorage.setItem('tf-budget-view:u:p', JSON.stringify({ wrap: true, density: 60 }));
  fireEvent.click(await openBudget());
  expect(screen.getByRole('checkbox', { name: 'Zobrazit mřížku' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Zalamovat text popisu' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Pohodlná' })).toHaveAttribute('aria-pressed', 'true');
});
it('keeps view controls under settings and preserves their saved values', async () => {
  const trigger = await openBudget();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('checkbox', { name: 'Zalamovat text popisu' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Zobrazení sloupců' })).not.toBeInTheDocument();
  expect(screen.queryByRole('switch', { name: 'Výkaz výměr' })).not.toBeInTheDocument();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Zalamovat text popisu' }));
  expect(screen.getByRole('group', { name: 'Hustota zobrazení' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Pohodlná' }));
  await waitFor(() => expect(JSON.parse(localStorage.getItem('tf-budget-view:u:p')!)).toMatchObject({ wrap: true, density: 60 }));
  fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Zalamovat text popisu' }), { key: 'Escape' });
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger);
  expect(screen.getByRole('checkbox', { name: 'Zalamovat text popisu' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Pohodlná' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.pointerDown(document.body);
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
it('opens column configuration from settings and restores focus to the settings button', async () => {
  const trigger = await openBudget();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: 'Zobrazení sloupců' }));
  expect(screen.getByRole('dialog', { name: 'Zobrazení sloupců' })).toBeVisible();
  expect(screen.getByText('Co znamená „Ponechat vlevo“?')).toBeVisible();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Zobrazit MJ', exact: true }));
  await waitFor(() => expect(JSON.parse(localStorage.getItem('tf-budget-view:u:p')!).columns.find((column: { key: string }) => column.key === 'unit').hidden).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: 'Zavřít dialog' }));
  expect(trigger).toHaveFocus();
});
it('orders columns in their pinned group and restores defaults without losing other view settings', async () => {
  const trigger = await openBudget();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Zalamovat text popisu' }));
  fireEvent.click(screen.getByRole('button', { name: 'Zobrazení sloupců' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Zobrazení sloupců' }));
  const names = () => dialog.getAllByRole('rowheader').map(row => row.textContent);
  expect(names().slice(0, 4)).toEqual(['Typ', 'Kód', 'Popis', 'MJ']);
  expect(dialog.getByRole('button', { name: 'Posunout Typ nahoru' })).toBeDisabled();
  expect(dialog.getByRole('button', { name: 'Posunout Kód dolů' })).toBeDisabled();
  expect(dialog.getByRole('button', { name: 'Posunout Popis nahoru' })).toBeDisabled();
  fireEvent.click(dialog.getByRole('button', { name: 'Posunout Popis dolů' }));
  expect(names().slice(0, 4)).toEqual(['Typ', 'Kód', 'MJ', 'Popis']);
  fireEvent.click(dialog.getByRole('checkbox', { name: 'Ponechat vlevo: Popis' }));
  expect(names().slice(0, 4)).toEqual(['Typ', 'Kód', 'Popis', 'MJ']);
  expect(dialog.getByRole('checkbox', { name: 'Ponechat vlevo: Popis' })).toHaveAccessibleDescription(/Šířku tím nezamykáte/);
  await waitFor(() => expect(JSON.parse(localStorage.getItem('tf-budget-view:u:p')!).columns.find((column: { key: string }) => column.key === 'description')).toMatchObject({ pinned: true, width: 420 }));
  fireEvent.click(dialog.getByRole('button', { name: 'Posunout Popis nahoru' }));
  expect(names().slice(0, 3)).toEqual(['Typ', 'Popis', 'Kód']);
  for (const checkbox of dialog.getAllByRole('checkbox', { name: /^Zobrazit / }).slice(1)) fireEvent.click(checkbox);
  expect(dialog.getByRole('checkbox', { name: 'Zobrazit Typ' })).toBeDisabled();
  expect(dialog.getByText('Zobrazeno 1 z 9 sloupců')).toBeVisible();
  fireEvent.click(dialog.getByRole('button', { name: 'Obnovit výchozí' }));
  expect(names().slice(0, 4)).toEqual(['Typ', 'Kód', 'Popis', 'MJ']);
  expect(dialog.getByRole('checkbox', { name: 'Ponechat vlevo: Popis' })).not.toBeChecked();
  expect(dialog.getByText('Zobrazeno 9 z 9 sloupců')).toBeVisible();
  await waitFor(() => expect(JSON.parse(localStorage.getItem('tf-budget-view:u:p')!)).toMatchObject({ wrap: true }));
  fireEvent.click(dialog.getByRole('button', { name: 'Hotovo' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
it('puts recap first, moves catalogs before settings and keeps tender-plan action unavailable', async () => {
  const trigger = await openBudget();
  const nav = within(screen.getByRole('navigation', { name: 'Sekce rozpočtu' }));
  expect(nav.getAllByRole('button').map(button => button.textContent)).toEqual(['Rekapitulace', 'Položky', 'Importy a verze']);
  expect(nav.getByRole('button', { name: 'Položky' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: 'Skrýt strom' })).toBeVisible();
  expect(screen.queryByRole('switch', { name: 'Výkaz výměr' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Rozsah:/ })).not.toBeInTheDocument();
  expect(trigger.parentElement?.previousElementSibling).toBe(screen.getByRole('button', { name: 'Firemní číselníky' }));
  fireEvent.click(screen.getByRole('button', { name: 'Akce rozpočtu' }));
  const plan = screen.getByRole('button', { name: 'Převzít do plánu VŘ' });
  expect(plan).toBeDisabled();
  expect(plan.parentElement?.lastElementChild).toBe(plan);
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: /^Rozsah:/ }));
  expect(screen.getByRole('dialog', { name: 'Rozsah rozpočtu' })).toBeVisible();
});
it('opens the shared main version, switches copies and saves a main-version change with a concurrency token', async () => {
  const main = { ...revision, id: 'main', title: 'Hlavní rozpočet' };
  vi.mocked(budgetApi.index).mockResolvedValue({ revisions: [revision, main], mainRevisionId: 'main', permissions: { read: true, prices: true, edit: true, confirm: false, allocate: false } });
  vi.mocked(budgetApi.revision).mockImplementation(async (_project, id) => id === 'main' ? main : revision);
  await openBudget();
  fireEvent.click(screen.getByRole('button', { name: 'Verze rozpočtu' }));
  expect(screen.getByRole('button', { name: 'Hlavní rozpočet · Pracovní · Hlavní' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Rozpočet · Pracovní', exact: true }));
  const setMain = await screen.findByRole('button', { name: 'Nastavit jako hlavní' });
  fireEvent.click(setMain);
  await waitFor(() => expect(budgetApi.setPrimary).toHaveBeenCalledWith('p', 'r', 'main'));
});
it('keeps the earliest active version selected when no shared main version has been set', async () => {
  const old = { ...revision, id: 'old', title: 'Původní', created_at: '2026-09-18T10:00:00Z' };
  vi.mocked(budgetApi.index).mockResolvedValue({ revisions: [{ ...revision, created_at: '2026-09-19T10:00:00Z' }, old], mainRevisionId: null, permissions: { read: true, prices: true, edit: false, confirm: false, allocate: false } });
  vi.mocked(budgetApi.revision).mockResolvedValue(old);
  await openBudget();
  fireEvent.click(screen.getByRole('button', { name: 'Verze rozpočtu' }));
  expect(screen.getByRole('button', { name: 'Původní · Pracovní · Hlavní' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('button', { name: 'Nastavit jako hlavní' })).not.toBeInTheDocument();
});
it('refreshes the shared main version on reopening even while the cached index is fresh', async () => {
  const main = { ...revision, id: 'new-main', title: 'Nová hlavní' };
  const permissions = { read: true, prices: true, edit: false, confirm: false, allocate: false };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300000 } } });
  client.setQueryData(['construction-budget', 'p', 'u', 'index'], { permissions, revisions: [revision, main], mainRevisionId: 'r' });
  vi.mocked(budgetApi.index).mockResolvedValue({ permissions, revisions: [revision, main], mainRevisionId: 'new-main' });
  vi.mocked(budgetApi.revision).mockImplementation(async (_project, id) => id === 'new-main' ? main : revision);
  render(<QueryClientProvider client={client}><ConstructionBudget projectId="p" userId="u" categories={[]}/></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Verze rozpočtu' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Nová hlavní · Pracovní · Hlavní' })).toHaveAttribute('aria-pressed', 'true'));
  expect(budgetApi.index).toHaveBeenCalledWith('p');
});

it('keeps budget navigation in one toolbar and reveals version and action controls on demand', async () => {
  await openBudget();
  expect(screen.queryByRole('group', { name: 'Verze rozpočtu', exact: true })).not.toBeInTheDocument();
  const toolbar = screen.getByRole('group', { name: 'Ovládání rozpočtu' });
  expect(within(toolbar).getByRole('navigation', { name: 'Sekce rozpočtu' })).toBeVisible();
  const versions = within(toolbar).getByRole('button', { name: 'Verze rozpočtu' });
  fireEvent.click(versions);
  expect(screen.getByRole('button', { name: 'Rozpočet · Pracovní · Hlavní' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.keyDown(screen.getByRole('button', { name: 'Rozpočet · Pracovní · Hlavní' }), { key: 'Escape' });
  expect(versions).toHaveFocus();
  expect(screen.queryByRole('group', { name: 'Verze rozpočtu', exact: true })).not.toBeInTheDocument();
  fireEvent.click(within(toolbar).getByRole('button', { name: 'Akce rozpočtu' }));
  expect(screen.getByRole('button', { name: 'Převzít do plánu VŘ' })).toBeDisabled();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('button', { name: 'Převzít do plánu VŘ' })).not.toBeInTheDocument();
});

it('creates a working copy from the action menu without changing the shared main version', async () => {
  const confirmed = { ...revision, status: 'confirmed' as const, source_id: 'source' };
  const copy = { ...revision, id: 'copy', title: 'Pracovní kopie' };
  const permissions = { read: true, prices: true, edit: true, confirm: true, allocate: false };
  vi.mocked(budgetApi.index).mockResolvedValue({ revisions: [confirmed], mainRevisionId: 'r', permissions });
  vi.mocked(budgetApi.revision).mockImplementation(async (_project, id) => id === 'copy' ? copy : confirmed);
  vi.mocked(budgetApi.save).mockImplementation(async () => {
    vi.mocked(budgetApi.index).mockResolvedValue({ revisions: [copy, confirmed], mainRevisionId: 'r', permissions });
    return copy;
  });
  await openBudget();
  expect(screen.queryByRole('button', { name: 'Vytvořit pracovní kopii' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Akce rozpočtu' }));
  fireEvent.click(screen.getByRole('button', { name: 'Vytvořit pracovní kopii' }));
  await waitFor(() => expect(budgetApi.save).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'p', sourceId: 'source', document: expect.objectContaining({ origin: 'copy' }) })));
  expect(await screen.findByRole('button', { name: 'Akce rozpočtu' })).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Verze rozpočtu' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pracovní kopie · Pracovní' })).toHaveAttribute('aria-pressed', 'true'));
  expect(screen.getByRole('button', { name: /Rozpočet · Potvrzená · Hlavní/ })).toBeInTheDocument();
  expect(budgetApi.setPrimary).not.toHaveBeenCalled();
});
it('shows tree and item-scope controls only for items and preserves them when returning from recap', async () => {
  localStorage.setItem('tf-budget-view:u:p', JSON.stringify({ scope: 'sheet-1', panel: false }));
  await openBudget();
  expect(screen.getByRole('button', { name: 'Zobrazit strom' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Rozsah: sheet-1 ×' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Rekapitulace', exact: true }));
  expect(screen.queryByRole('button', { name: /strom$/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Rozsah:/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Nastavení zobrazení' }));
  expect(screen.queryByRole('button', { name: /^Rozsah:/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Položky', exact: true }));
  expect(screen.getByRole('button', { name: 'Zobrazit strom' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Rozsah: sheet-1 ×' })).toBeVisible();
});
it('keeps cached budget visible when refreshing the shared index fails', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300000 } } });
  client.setQueryData(['construction-budget', 'p', 'u', 'index'], { revisions: [revision], mainRevisionId: 'r', permissions: { read: true, prices: true, edit: false, confirm: false, allocate: false } });
  client.setQueryData(['construction-budget', 'p', 'u', 'revision', 'r'], revision);
  vi.mocked(budgetApi.index).mockRejectedValue(new Error('Dočasný výpadek sítě'));
  render(<QueryClientProvider client={client}><ConstructionBudget projectId="p" userId="u" categories={[]}/></QueryClientProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Dočasný výpadek sítě');
  expect(screen.getByRole('navigation', { name: 'Sekce rozpočtu' })).toBeVisible();
  expect(screen.getByRole('region', { name: 'Položky rozpočtu' })).toBeVisible();
});
it('keeps company catalogs accessible without any revision and in imports', async () => {
  vi.mocked(budgetApi.index).mockResolvedValue({ revisions: [], permissions: { read: true, prices: true, edit: false, confirm: false, allocate: false } });
  const trigger = await screenAfterEmptyBudget();
  expect(trigger).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Importy a verze' }));
  expect(screen.getByRole('button', { name: 'Firemní číselníky' })).toBeVisible();
});
async function screenAfterEmptyBudget() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ConstructionBudget projectId="p" userId="u" categories={[]}/></QueryClientProvider>);
  return screen.findByRole('button', { name: 'Firemní číselníky' });
}
it('retains per-item quantity expansion across tabs and clears it when the revision changes', async () => {
  const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
  const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
  const item = { id: 'item', parentId: null, sheetId: 's', kind: 'K', order: 0, code: '123', description: 'Výkop', unit: 'm3', quantity: '12', unitPrice: '10', total: '120', source: { sheet: 'Soupis', row: 1, cells: {} }, sourceType: 'K', tags: [], tenders: [] };
  const withRows = { ...revision, document: { ...revision.document, nodes: [item, { ...item, id: 'vv', parentId: 'item', kind: 'VV', order: 1, description: '3*4' }] } } as BudgetRevision;
  const other = { ...withRows, id: 'other', title: 'Jiná' };
  vi.mocked(budgetApi.index).mockResolvedValue({ revisions: [withRows, other], mainRevisionId: 'r', permissions: { read: true, prices: true, edit: false, confirm: false, allocate: false } });
  vi.mocked(budgetApi.revision).mockImplementation(async (_project, id) => id === 'other' ? other : withRows);
  try {
    await openBudget();
    fireEvent.click(screen.getByRole('button', { name: 'Výkaz výměr: 123' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rekapitulace', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Položky', exact: true }));
    expect(screen.getByRole('button', { name: 'Výkaz výměr: 123' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Verze rozpočtu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jiná · Pracovní' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Výkaz výměr: 123' })).toHaveAttribute('aria-expanded', 'false'));
  } finally { width.mockRestore(); height.mockRestore(); }
});
it('keeps a wrapped dropdown inside the viewport', async () => {
  const geometry = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { x: 8, y: 80, left: 8, top: 80, right: this.classList.contains('tf-budget-button-menu-panel') ? 308 : 68, bottom: 112, width: this.classList.contains('tf-budget-button-menu-panel') ? 300 : 60, height: 32, toJSON: () => ({}) };
  });
  try {
    await openBudget();
    fireEvent.click(screen.getByRole('button', { name: 'Verze rozpočtu' }));
    expect(screen.getByRole('group', { name: 'Verze rozpočtu', exact: true }).style.left).toBe('0px');
  } finally { geometry.mockRestore(); }
});
it('clears revision-specific selection, undo and scope when another user changes the main revision', async () => {
  const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
  const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
  const item = { id: 'item', parentId: null, sheetId: 's', kind: 'K', order: 0, code: '123', description: 'Výkop', unit: 'm3', quantity: '12', unitPrice: '10', total: '120', source: { sheet: 'Soupis', row: 1, cells: {} }, sourceType: 'K', tags: [], tenders: [] };
  const first = { ...revision, document: { ...revision.document, nodes: [item] } } as BudgetRevision;
  const other = { ...first, id: 'other', title: 'Jiná', version: 2 };
  const permissions = { read: true, prices: true, edit: true, confirm: false, allocate: false };
  vi.mocked(budgetApi.index).mockResolvedValue({ revisions: [first, other], mainRevisionId: 'r', permissions });
  vi.mocked(budgetApi.revision).mockImplementation(async (_project, id) => id === 'other' ? other : first);
  vi.mocked(budgetApi.save).mockResolvedValue({ ...first, version: 2 });
  localStorage.setItem('tf-budget-view:u:p', JSON.stringify({ scope: 's' }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    render(<QueryClientProvider client={client}><ConstructionBudget projectId="p" userId="u" categories={[]}/></QueryClientProvider>);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Vybrat 123' }));
    expect(screen.getByText('1 vybraných položek napříč rozsahy')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Výkop', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změnu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Akce rozpočtu' }));
    expect(screen.getByRole('button', { name: 'Zpět' })).toBeVisible();
    vi.mocked(budgetApi.index).mockResolvedValue({ revisions: [first, other], mainRevisionId: 'other', permissions });
    await client.invalidateQueries({ queryKey: ['construction-budget', 'p', 'u', 'index'] });
    await waitFor(() => expect(budgetApi.revision).toHaveBeenCalledWith('p', 'other'));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Vybrat 123' })).not.toBeChecked());
    expect(screen.queryByText('1 vybraných položek napříč rozsahy')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zpět' })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('tf-budget-view:u:p')!).scope).toBe('');
  } finally { width.mockRestore(); height.mockRestore(); }
});

it('requires allocation permission to copy a confirmed revision with assignments', async () => {
  const confirmed = { ...revision, status: 'confirmed' as const, allocations: [{ itemId: 'item', categoryId: 'category', quantity: '1' }] };
  vi.mocked(budgetApi.index).mockResolvedValue({ revisions: [confirmed], permissions: { read: true, prices: true, edit: true, confirm: true, allocate: false } });
  vi.mocked(budgetApi.revision).mockResolvedValue(confirmed);
  await openBudget();
  fireEvent.click(screen.getByRole('button', { name: 'Akce rozpočtu' }));
  const copy = screen.getByRole('button', { name: 'Vytvořit pracovní kopii' });
  expect(copy).toBeDisabled();
  expect(copy).toHaveAttribute('title', 'Kopírování přiřazení vyžaduje oprávnění k alokacím.');
});

it.each([false,true])('gates tender import on pipeline availability (%s) independently of allocation permission',async canUseTenders=>{
  vi.mocked(budgetApi.index).mockResolvedValue({revisions:[revision],permissions:{prices:true,edit:true,confirm:false,allocate:true}});
  await openBudget(canUseTenders);
  await waitFor(()=>expect(budgetApi.revision).toHaveBeenCalled());
  expect(!!screen.queryByRole('button',{name:'Vlastní vzory VŘ'})).toBe(canUseTenders);
  fireEvent.click(screen.getByRole('button',{name:'Importovat'}));
  expect(!!screen.queryByRole('radio',{name:/Pouze převzít přiřazení do VŘ/})).toBe(canUseTenders);
});

it('shows the prominent total only on the recap tab and keeps the items sidebar compact', async () => {
  localStorage.setItem('tf-budget-view:u:p', JSON.stringify({ panel: true }));
  await openBudget();
  expect(screen.queryByRole('region', { name: 'Cena celkem' })).not.toBeInTheDocument();
  expect(screen.getByText('Celý rozpočet · 0,00 Kč')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Rekapitulace', exact: true }));
  expect(within(screen.getByRole('region', { name: 'Cena celkem' })).getByText('0,00 Kč')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Položky', exact: true }));
  expect(screen.queryByRole('region', { name: 'Cena celkem' })).not.toBeInTheDocument();
  expect(screen.getByText('Celý rozpočet · 0,00 Kč')).toBeVisible();
});
