import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConstructionBudget } from '@features/projects/budget/ui/ConstructionBudget';
import { budgetApi } from '@features/projects/budget/api/budgetApi';
import type { BudgetRevision } from '@features/projects/budget/model/types';

vi.mock('@features/projects/budget/api/budgetApi', () => ({ budgetApi: { index: vi.fn(), sources: vi.fn(), revision: vi.fn(), setPrimary: vi.fn(), importTenders: vi.fn(), setAssignments: vi.fn(), undoPatch: vi.fn(), editItem: vi.fn(), save: vi.fn(), history: vi.fn().mockResolvedValue([]), setLock: vi.fn(), saveProjectTenders:vi.fn().mockResolvedValue(undefined), projectTenders: vi.fn().mockResolvedValue([{id:"vr",title:"Zemní práce",externalCode:"01"}]) } }));
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
it('explains how to assign tenders in a confirmed revision without enabling writes', async () => {
  const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
  const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
  const item = { id: 'item', parentId: null, sheetId: 's', kind: 'K', order: 0, code: '123', description: 'Výkop', unit: 'm3', quantity: '12', unitPrice: '10', total: '120', source: { sheet: 'S', row: 1, cells: {} }, sourceType: 'K', tags: [], tenders: [] };
  const confirmed = { ...revision, status: 'confirmed', document: { ...revision.document, nodes: [item] } } as BudgetRevision;
  vi.mocked(budgetApi.index).mockResolvedValue({ revisions: [confirmed], permissions: { read: true, prices: true, edit: true, confirm: true, allocate: true } });
  vi.mocked(budgetApi.revision).mockResolvedValue(confirmed);
  try {
    await openBudget();
    fireEvent.click(screen.getByRole('button', { name: 'Položky', exact: true }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Vybrat 123' }));
    expect(screen.getByRole('combobox',{name:'VŘ pro vybrané položky'})).toBeDisabled();
    expect(screen.getByText(/Tato verze je potvrzená\./)).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Cílové VŘ' })).not.toBeInTheDocument();
    expect(budgetApi.save).not.toHaveBeenCalled();
  } finally { width.mockRestore(); height.mockRestore(); }
});
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
  expect(dialog.getByText('Zobrazeno 1 z 8 sloupců')).toBeVisible();
  fireEvent.click(dialog.getByRole('button', { name: 'Obnovit výchozí' }));
  expect(names().slice(0, 4)).toEqual(['Typ', 'Kód', 'Popis', 'MJ']);
  expect(dialog.getByRole('checkbox', { name: 'Ponechat vlevo: Popis' })).not.toBeChecked();
  expect(dialog.getByText('Zobrazeno 8 z 8 sloupců')).toBeVisible();
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
  expect(trigger.parentElement?.previousElementSibling).toBe(screen.getByRole('button', { name: 'Uzamknout rozpočet' }));
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
  vi.mocked(budgetApi.editItem).mockResolvedValue({id:first.id,version:2,node:item as BudgetRevision['document']['nodes'][number],allocations:[],resolvedIssueIndexes:[]});
  localStorage.setItem('tf-budget-view:u:p', JSON.stringify({ scope: 's' }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    render(<QueryClientProvider client={client}><ConstructionBudget projectId="p" userId="u" categories={[]}/></QueryClientProvider>);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Vybrat 123' }));
    expect(screen.getByText('Vybráno 1 položek')).toBeVisible();
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Výkop', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změnu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Akce rozpočtu' }));
    expect(screen.getByRole('button', { name: 'Zpět' })).toBeVisible();
    vi.mocked(budgetApi.index).mockResolvedValue({ revisions: [first, other], mainRevisionId: 'other', permissions });
    await client.invalidateQueries({ queryKey: ['construction-budget', 'p', 'u', 'index'] });
    await waitFor(() => expect(budgetApi.revision).toHaveBeenCalledWith('p', 'other'));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Vybrat 123' })).not.toBeChecked());
    expect(screen.queryByText('Vybráno 1 položek')).not.toBeInTheDocument();
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
  expect(!!screen.queryByRole('button',{name:'Číselník VŘ'})).toBe(canUseTenders);
  fireEvent.click(screen.getByRole('button',{name:'Importy a verze'}));
  fireEvent.click(screen.getByRole('button',{name:'Importovat'}));
  expect(!!screen.queryByRole('radio',{name:/Pouze převzít přiřazení do VŘ/})).toBe(canUseTenders);
});

it('places import and export in versions and unlocks using the current server token', async () => {
  const permissions = { read: true, prices: true, edit: true, confirm: true, allocate: true };
  vi.mocked(budgetApi.index).mockResolvedValue({ revisions: [revision], permissions, locked: true, lockVersion: 4 });
  vi.mocked(budgetApi.setLock).mockResolvedValue(undefined);
  await openBudget();
  expect(screen.queryByRole('button', { name: 'Importovat' })).not.toBeInTheDocument();
  const unlock = screen.getByRole('button', { name: 'Odemknout rozpočet' });
  expect(unlock).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Akce rozpočtu' }));
  expect(screen.queryByRole('button', { name: 'Potvrdit rozpočet' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Importy a verze' }));
  expect(screen.getByRole('button', { name: 'Importovat' })).toBeDisabled();
  fireEvent.click(unlock);
  await waitFor(() => expect(budgetApi.setLock).toHaveBeenCalledWith('p', false, 4));
});
it('assigns multiple clicked rows to a tender and clears selection without deleting items', async () => {
  const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
  const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
  const item = { id: 'item', parentId: null, sheetId: 's', kind: 'K', order: 0, code: '123', description: 'Výkop', unit: 'm3', quantity: '12', unitPrice: '10', total: '120', source: { sheet: 'Soupis', row: 1, cells: {} }, sourceType: 'K', tags: [], tenders: [] };
  const withRows = { ...revision, document: { ...revision.document, nodes: [item, { ...item, id: 'other', code: '456', description: 'Beton', order: 1 }] } } as BudgetRevision;
  vi.mocked(budgetApi.index).mockResolvedValue({ revisions: [withRows], permissions: { read: true, prices: true, edit: true, confirm: true, allocate: true } });
  vi.mocked(budgetApi.revision).mockResolvedValue(withRows);
  vi.mocked(budgetApi.setAssignments).mockResolvedValue({id:withRows.id,version:2,itemIds:['item','other'],allocations:[]});
  try {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><ConstructionBudget projectId="p" userId="u" categories={[{ id: 'vr', title: 'Zemní práce' } as never]} canUseTenders/></QueryClientProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Výkop', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Beton', exact: true }), { ctrlKey: true });

    fireEvent.click(screen.getByRole('combobox', { name: 'VŘ pro vybrané položky' }));
    expect(screen.queryByRole('region',{name:'Přiřazení množství do VŘ'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option',{name:'Zemní práce'}));
    await waitFor(() => expect(budgetApi.setAssignments).toHaveBeenCalledWith('p',expect.objectContaining({ itemIds:['item','other'],categoryId:'vr' })));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Zrušit výběr' }));
    expect(screen.getByRole('checkbox', { name: 'Vybrat 123' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Vybrat 456' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Beton', exact: true })).toBeVisible();
    expect(budgetApi.setAssignments).toHaveBeenCalledTimes(1);
  } finally { width.mockRestore(); height.mockRestore(); }
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

it('allows pipeline editors to edit the tender catalog without budget item editing rights',async()=>{
 vi.mocked(budgetApi.index).mockResolvedValue({revisions:[revision],permissions:{read:true,prices:false,edit:false,confirm:false,allocate:false,editTenders:true}});
 await openBudget(true);fireEvent.click(screen.getByRole('button',{name:'Číselník VŘ'}));
 expect(await screen.findByLabelText('Název VŘ 1')).not.toBeDisabled();
 expect(screen.getByRole('button',{name:'Přidat VŘ'})).not.toBeDisabled();
 expect(screen.getByRole('button',{name:'Importovat / exportovat vzor'})).toBeDisabled();
});

it('defaults notes off for older settings and persists their independent toggle', async () => {
 localStorage.setItem('tf-budget-view:u:p',JSON.stringify({wrap:true}));
 fireEvent.click(await openBudget());
 expect(screen.getByRole('checkbox',{name:'Zobrazit poznámky'})).not.toBeChecked();
 fireEvent.click(screen.getByRole('checkbox',{name:'Zobrazit poznámky'}));
 await waitFor(()=>expect(JSON.parse(localStorage.getItem('tf-budget-view:u:p')!)).toMatchObject({showNotes:true,wrap:true}));
 cleanup();fireEvent.click(await openBudget());
 expect(screen.getByRole('checkbox',{name:'Zobrazit poznámky'})).toBeChecked();
 fireEvent.click(screen.getByRole('checkbox',{name:'Zobrazit poznámky'}));
 await waitFor(()=>expect(JSON.parse(localStorage.getItem('tf-budget-view:u:p')!)).toMatchObject({showNotes:false}));
});

it('refreshes only catalog and project details when creating a tender before assignment',async()=>{
 const width=vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(1600);
 const height=vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockReturnValue(400);
 const item={id:'item',parentId:null,sheetId:'s',kind:'K',order:0,code:'123',description:'Výkop',unit:'m3',quantity:'12',unitPrice:'10',total:'120',source:{sheet:'Soupis',row:1,cells:{}},sourceType:'K',tags:[],tenders:[]} as const;
 const current={...revision,document:{...revision.document,nodes:[{...item,tags:[],tenders:[]}]}} as BudgetRevision;
 vi.mocked(budgetApi.index).mockResolvedValue({revisions:[current],permissions:{read:true,edit:true,prices:true,allocate:true,editTenders:true,confirm:false}});
 vi.mocked(budgetApi.revision).mockResolvedValue(current);
 vi.mocked(budgetApi.setAssignments).mockImplementation(async(_project,request)=>({id:current.id,version:2,itemIds:request.itemIds,allocations:[{itemId:'item',categoryId:request.categoryId!,quantity:'12'}]}));
 try{
  await openBudget();
  fireEvent.click(screen.getByRole('checkbox',{name:'Vybrat 123'}));

  fireEvent.click(screen.getByRole('button',{name:'Nové VŘ'}));
  fireEvent.change(screen.getByLabelText('Název nového VŘ'),{target:{value:'Nová fasáda'}});
  fireEvent.click(screen.getByRole('button',{name:'Vytvořit a přiřadit'}));
  await waitFor(()=>expect(budgetApi.setAssignments).toHaveBeenCalled());
  await waitFor(()=>expect(within(screen.getByRole('button',{name:'Výkop',exact:true}).closest('[role="row"]') as HTMLElement).getByText('Nová fasáda')).toBeVisible());
  expect(budgetApi.revision).toHaveBeenCalledTimes(1);
 }finally{width.mockRestore();height.mockRestore();}
});

it('assigns through a small idempotent request and retains the retry key after a lost response',async()=>{
 const width=vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(1200),height=vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockReturnValue(400);
 const item={id:'item',parentId:null,sheetId:'s',kind:'K',order:0,code:'123',description:'Výkop',unit:'m3',quantity:'12',unitPrice:'10',total:'120',source:{sheet:'S',row:1,cells:{}},tags:[],tenders:[]};
 const current={...revision,source_id:'source',document:{...revision.document,nodes:[item]}} as BudgetRevision;
 vi.mocked(budgetApi.index).mockResolvedValue({revisions:[current],permissions:{read:true,prices:true,edit:true,allocate:true,confirm:false}});
 vi.mocked(budgetApi.revision).mockResolvedValue(current);
 vi.mocked(budgetApi.setAssignments).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({id:current.id,version:2,itemIds:['item'],allocations:[{itemId:'item',categoryId:'vr',quantity:'12'}]});
 try{
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><ConstructionBudget projectId="p" categories={[{id:'vr',title:'Zemní práce'} as never]} canUseTenders/></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button',{name:'Výkop',exact:true}));
  expect(screen.getByLabelText('VŘ pro vybrané položky').closest('.tf-budget-selection')).not.toBeNull();
  fireEvent.change(screen.getByLabelText('VŘ pro vybrané položky'),{target:{value:'vr'}});
  await screen.findByRole('alert');
  expect(budgetApi.save).not.toHaveBeenCalled();
  const request=vi.mocked(budgetApi.setAssignments).mock.calls[0][1];
  expect(request).toMatchObject({revisionId:'r',version:1,itemIds:['item'],categoryId:'vr'});
  expect(request).not.toHaveProperty('document');expect(request).not.toHaveProperty('allocations');
  expect(screen.getByLabelText('VŘ pro vybrané položky').closest('.tf-budget-selection')).not.toBeNull();
  fireEvent.change(screen.getByLabelText('VŘ pro vybrané položky'),{target:{value:'vr'}});
  await waitFor(()=>expect(budgetApi.setAssignments).toHaveBeenCalledTimes(2));
  expect(vi.mocked(budgetApi.setAssignments).mock.calls[1][1]).toEqual(request);
  await waitFor(()=>expect(screen.getByRole('combobox',{name:'VŘ pro vybrané položky'})).toBeEnabled());
  expect(screen.queryByRole('button',{name:'Přiřadit VŘ',exact:true})).not.toBeInTheDocument();
  vi.mocked(budgetApi.undoPatch).mockResolvedValueOnce({id:'r',version:3});
  fireEvent.click(screen.getByRole('button',{name:'Akce rozpočtu'}));fireEvent.click(screen.getByRole('button',{name:'Zpět',exact:true}));
  await waitFor(()=>expect(budgetApi.undoPatch).toHaveBeenCalledWith('p',expect.objectContaining({version:2,undoOperationId:request.operationId})));
  await waitFor(()=>expect(within(screen.getByRole('button',{name:'Výkop',exact:true}).closest('[role="row"]') as HTMLElement).queryByText('Zemní práce')).not.toBeInTheDocument());
  expect(budgetApi.save).not.toHaveBeenCalled();

 }finally{width.mockRestore();height.mockRestore();}
});

it('preserves budget allocation rights without requiring pipeline editing',async()=>{
 const width=vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(1200),height=vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockReturnValue(400);
 const item={id:'item',parentId:null,sheetId:'s',kind:'K',order:0,code:'123',description:'Výkop',unit:'m3',quantity:'12',unitPrice:'10',total:'120',source:{sheet:'S',row:1,cells:{}},tags:[],tenders:[]};
 const current={...revision,source_id:'source',document:{...revision.document,nodes:[item]}} as BudgetRevision;
 vi.mocked(budgetApi.index).mockResolvedValue({revisions:[current],permissions:{read:true,prices:true,edit:true,allocate:true,confirm:false}});
 vi.mocked(budgetApi.revision).mockResolvedValue(current);
 vi.mocked(budgetApi.setAssignments).mockResolvedValueOnce({id:current.id,version:2,itemIds:['item'],allocations:[{itemId:'item',categoryId:'vr',quantity:'12'}]});
 vi.mocked(budgetApi.save).mockResolvedValue({...current,version:2});
 try{
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><ConstructionBudget projectId="p" categories={[{id:'vr',title:'Zemní práce'} as never]} canUseTenders/></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button',{name:'Výkop',exact:true}));
  expect(screen.getByLabelText('VŘ pro vybrané položky').closest('.tf-budget-selection')).not.toBeNull();
  fireEvent.change(screen.getByLabelText('VŘ pro vybrané položky'),{target:{value:'vr'}});
  await waitFor(()=>expect(budgetApi.setAssignments).toHaveBeenCalledWith('p',expect.objectContaining({itemIds:['item'],categoryId:'vr'})));
  expect(budgetApi.save).not.toHaveBeenCalled();
  expect(budgetApi.setAssignments).toHaveBeenCalledTimes(1);
 }finally{width.mockRestore();height.mockRestore();}
});

it('shows assignment immediately and rolls it back with a durable error after selection is cleared',async()=>{
 const width=vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(1200),height=vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockReturnValue(400);
 const item={id:'item',parentId:null,sheetId:'s',kind:'K',order:0,code:'123',description:'Výkop',unit:'m3',quantity:'12',unitPrice:'10',total:'120',source:{sheet:'S',row:1,cells:{}},tags:[],tenders:[]};
 const current={...revision,source_id:'source',document:{...revision.document,nodes:[item]}} as BudgetRevision;
 vi.mocked(budgetApi.index).mockResolvedValue({revisions:[current],permissions:{read:true,prices:true,edit:true,allocate:true,confirm:false}});
 vi.mocked(budgetApi.revision).mockResolvedValue(current);
 let fail!:(error:Error)=>void;
 vi.mocked(budgetApi.setAssignments).mockImplementationOnce(()=>new Promise((_,reject)=>{fail=reject;}));
 try{
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><ConstructionBudget projectId="p" categories={[{id:'vr',title:'Zemní práce'} as never]} canUseTenders/></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button',{name:'Výkop',exact:true}));
  expect(screen.getByLabelText('VŘ pro vybrané položky').closest('.tf-budget-selection')).not.toBeNull();
  fireEvent.change(screen.getByLabelText('VŘ pro vybrané položky'),{target:{value:'vr'}});
  const row=screen.getByRole('button',{name:'Výkop',exact:true}).closest('[role="row"]') as HTMLElement;
  expect(within(row).getByText('Zemní práce')).toBeVisible();
  expect(within(row).getByText('Ukládání…')).toBeVisible();
  expect(screen.getByRole('button',{name:'Exportovat výběr'})).toBeDisabled();
  await waitFor(()=>expect(budgetApi.setAssignments).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button',{name:'Zrušit výběr'}));
  fail(new Error('canceling statement due to statement timeout'));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('časový limit'));
  expect(within(row).queryByText('Zemní práce')).not.toBeInTheDocument();
  expect(within(row).queryByText('Ukládání…')).not.toBeInTheDocument();
 }finally{width.mockRestore();height.mockRestore();}
});
it.each([false,true])('removes retired tags and keeps visible columns when all others were hidden: %s',async(hidden)=>{
 localStorage.setItem('tf-budget-view:u:p',JSON.stringify({columns:[{key:'tags',label:'Štítky',width:150},{key:'description',label:'Popis',width:420,hidden}]}));
 fireEvent.click(await openBudget());fireEvent.click(screen.getByRole('button',{name:/Zobrazení sloupců/}));
 expect(screen.queryByText('Štítky')).not.toBeInTheDocument();
 expect(screen.queryByLabelText('Štítek výběru')).not.toBeInTheDocument();
 expect(JSON.parse(localStorage.getItem('tf-budget-view:u:p')!).columns.some((column:{key:string})=>column.key==='tags')).toBe(false);
});

it('saves a cell through a small request, retries lost responses and updates totals without refetching the document',async()=>{
 const width=vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(1200),height=vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockReturnValue(400);
 const item={id:'item',parentId:null,sheetId:'s',kind:'K',order:0,code:'123',description:'Výkop',unit:'m3',quantity:'2600',unitPrice:null,total:'0',source:{sheet:'S',row:1,cells:{}},tags:[],tenders:[]};
 const current={...revision,source_id:'source',document:{...revision.document,nodes:[item]}} as BudgetRevision;
 vi.mocked(budgetApi.index).mockResolvedValue({revisions:[current],permissions:{read:true,prices:true,edit:true,allocate:true,confirm:false}});
 vi.mocked(budgetApi.revision).mockResolvedValue(current);
 vi.mocked(budgetApi.editItem).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({id:'r',version:2,node:{...current.document.nodes[0],unitPrice:'100',total:'260000.00'},allocations:[],resolvedIssueIndexes:[]});
 try{
  await openBudget();
  const row=(await screen.findByRole('button',{name:'Výkop',exact:true})).closest('[role="row"]') as HTMLElement;
  fireEvent.doubleClick(row.children[7]);
  fireEvent.change(screen.getByRole('textbox',{name:'Upravit J. cena'}),{target:{value:'100'}});
  fireEvent.keyDown(screen.getByRole('textbox',{name:'Upravit J. cena'}),{key:'Enter'});
  expect(await screen.findByRole('alert')).toHaveTextContent('Hodnota zůstala rozepsaná');
  const request=vi.mocked(budgetApi.editItem).mock.calls[0][1];
  expect(request).toMatchObject({revisionId:'r',version:1,itemId:'item',patch:{unitPrice:'100',total:'260000.00'}});
  expect(JSON.stringify(request).length).toBeLessThan(500);
  fireEvent.keyDown(screen.getByRole('textbox',{name:'Upravit J. cena'}),{key:'Enter'});
  await waitFor(()=>expect(screen.queryByRole('textbox',{name:'Upravit J. cena'})).not.toBeInTheDocument());
  expect(vi.mocked(budgetApi.editItem).mock.calls[1][1]).toEqual(request);
  expect(within(row).getByText('260 000,00')).toBeVisible();
  vi.mocked(budgetApi.undoPatch).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({id:'r',version:3});
  fireEvent.click(screen.getByRole('button',{name:'Akce rozpočtu'}));fireEvent.click(screen.getByRole('button',{name:'Zpět',exact:true}));
  await waitFor(()=>expect(budgetApi.undoPatch).toHaveBeenCalledTimes(1));
  const undoRequest=vi.mocked(budgetApi.undoPatch).mock.calls[0][1];expect(undoRequest).toMatchObject({version:2,undoOperationId:request.operationId});expect(JSON.stringify(undoRequest).length).toBeLessThan(500);
  await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Akce rozpočtu'}));fireEvent.click(screen.getByRole('button',{name:'Zpět',exact:true}));
  await waitFor(()=>expect(within(row).queryByText('260 000,00')).not.toBeInTheDocument());
  expect(vi.mocked(budgetApi.undoPatch).mock.calls[1][1]).toEqual(undoRequest);
  expect(budgetApi.save).not.toHaveBeenCalled();expect(budgetApi.revision).toHaveBeenCalledTimes(1);
 }finally{width.mockRestore();height.mockRestore();}
});

it('uses a small removal request and retains its failure after selection is cleared',async()=>{
 const width=vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(1200),height=vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockReturnValue(400);
 const item={id:'item',parentId:null,sheetId:'s',kind:'K',order:0,code:'123',description:'Výkop',unit:'m3',quantity:'12',unitPrice:'10',total:'120',source:{sheet:'S',row:1,cells:{}},tags:[],tenders:[]};
 const current={...revision,source_id:'source',allocations:[{itemId:'item',categoryId:'vr',quantity:'12'}],document:{...revision.document,nodes:[item]}} as BudgetRevision;
 vi.mocked(budgetApi.index).mockResolvedValue({revisions:[current],permissions:{read:true,prices:true,edit:true,allocate:true,confirm:false}});vi.mocked(budgetApi.revision).mockResolvedValue(current);
 let fail!:(error:Error)=>void;vi.mocked(budgetApi.setAssignments).mockImplementationOnce(()=>new Promise((_,reject)=>{fail=reject;}));
 try{
  await openBudget();fireEvent.click(await screen.findByRole('button',{name:'Výkop',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Odebrat VŘ'}));
  await waitFor(()=>expect(budgetApi.setAssignments).toHaveBeenCalledWith('p',expect.objectContaining({categoryId:null,itemIds:['item']})));
  expect(budgetApi.save).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Zrušit výběr'}));fail(new Error('Konflikt verze'));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Konflikt verze'));
 }finally{width.mockRestore();height.mockRestore();}
});
