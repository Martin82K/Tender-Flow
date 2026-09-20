import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BudgetTable, DEFAULT_COLUMNS } from '@features/projects/budget/ui/BudgetTable';
import { applyBudgetItemEdit } from '@features/projects/budget/model/revisions';
import type { BudgetDocument, BudgetNode } from '@features/projects/budget/model/types';
import type { BudgetFilters } from '@features/projects/budget/model/budgetModel';

// jsdom has no layout. Supply geometry while exercising the real virtualizer.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    if (!this.hasAttribute('data-index')) return 400;
    if (this.querySelector('.tf-budget-wrap')) return this.classList.contains('tf-budget-quantity-detail') ? 72 : 96;
    return Number.parseFloat(this.style.minHeight);
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const item: BudgetNode = { id: 'item', parentId: null, sheetId: 's', kind: 'K', order: 0, code: '123', description: 'Výkop základů', unit: 'm3', quantity: '12', unitPrice: '10', total: '120', source: { sheet: 'Soupis', row: 1, cells: {} }, sourceType: 'K', tags: [], tenders: [] };
const nodes: BudgetNode[] = [item,
  { ...item, id: 'note', parentId: 'item', kind: 'note', order: 1, code: '', description: 'Poznámka k výkopu', quantity: null, unitPrice: null, total: null, sourceType: 'P' },
  { ...item, id: 'vv', parentId: 'item', kind: 'VV', order: 2, code: '', description: '3*4', quantity: '12', unitPrice: null, total: null, sourceType: 'VV' },
  { ...item, id: 'missing', order: 3, code: '456', description: 'Neoceněná práce', unitPrice: null, total: null },
];
function table(showVV = true, canPrices = true, wrap = false, density = 44) {
  return <BudgetTable nodes={nodes} scope="" filters={{}} onFilters={vi.fn()} selected={new Set()} onSelected={vi.fn()} showVV={showVV} wrap={wrap} density={density} columns={DEFAULT_COLUMNS} onColumns={vi.fn()} canPrices={canPrices} editable={false} onEdit={vi.fn()} onNotice={vi.fn()}/>;
}
it('recalculates an imported quantity expression without its stored result and annotation', () => {
  render(<BudgetTable {...table().props} editable nodes={[item, { ...nodes[2], description: '2*1 = 2,000 [A]' }]}/>);
  fireEvent.contextMenu(screen.getByRole('button', { name: item.description }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Detail položky' }));
  fireEvent.click(screen.getByRole('button', { name: 'Přepočítat výraz a připravit množství' }));
  expect(screen.getByRole('textbox', { name: 'Množství' })).toHaveValue('2');
  expect(screen.getByRole('alert')).toHaveTextContent('Výsledek 2 je připraven');
});
it('handles a repeated explicit jump while preserving filters that hide the target', () => {
  const onNotice = vi.fn();
  const props = { ...table().props, jumpId: 'item', filters: { code: { search: 'missing-code' } }, onNotice };
  const { rerender } = render(<BudgetTable {...props} jumpRequest={1}/>);
  expect(onNotice).toHaveBeenCalledTimes(1);
  rerender(<BudgetTable {...props} jumpRequest={2}/>);
  expect(onNotice).toHaveBeenCalledTimes(2);
  expect(onNotice).toHaveBeenLastCalledWith(expect.stringContaining('Filtry zůstaly zachované'));
});
it('shows quantity details under their item without treating unpriced details as missing prices', () => {
  render(table());
  expect(screen.getAllByText('Neoceněno')).toHaveLength(1);
  const quantityRow = screen.getByRole('button', { name: '3*4' }).closest('[role="row"]')!;
  expect(within(quantityRow as HTMLElement).getByText('12')).toBeVisible();
  expect(within(quantityRow as HTMLElement).queryByRole('checkbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '3*4' }));
  expect(screen.getByRole('textbox', { name: 'Úplný popis' })).toHaveValue('3*4');
  expect(screen.queryByRole('button', { name: 'Uložit změnu' })).not.toBeInTheDocument();
});
it('opens the full item description from its name without a separate expansion link', () => {
  const description = 'Výkop základů včetně odvozu vytěžené zeminy a uložení na skládku';
  render(<BudgetTable {...table().props} nodes={[{ ...item, description }]}/>);
  expect(screen.queryByRole('button', { name: 'Celý popis' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Zkrátit popis' })).not.toBeInTheDocument();
  fireEvent.doubleClick(screen.getByRole('button', { name: description }));
  expect(screen.getByRole('textbox', { name: 'Úplný popis' })).toHaveValue(description);
  expect(screen.queryByRole('button', { name: 'Uložit změnu' })).not.toBeInTheDocument();
});
it('hides quantity details through the existing switch and respects price visibility', () => {
  const { rerender } = render(table());
  rerender(table(false, false));
  expect(screen.queryByText('3*4')).not.toBeInTheDocument();
  expect(screen.queryByText('Poznámka k výkopu')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Výkop základů' })).toBeVisible();
  expect(screen.queryByText('Neoceněno')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'J. cena ▾' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Sbalit 123' })).not.toBeInTheDocument();
});
it('toggles item details with plus and minus before the selection checkbox', () => {
  render(<BudgetTable {...table().props} showNotes/>);
  const collapse = screen.getByRole('button', { name: 'Sbalit 123' });
  const row = collapse.closest('[role="row"]')!;
  expect(row.firstElementChild).toContainElement(collapse);
  expect(row.children[1]).toContainElement(screen.getByRole('checkbox', { name: 'Vybrat 123' }));
  expect(collapse).toHaveTextContent('−');
  expect(collapse).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(collapse);
  expect(screen.queryByText('3*4')).not.toBeInTheDocument();
  expect(screen.queryByText('Poznámka k výkopu')).not.toBeInTheDocument();
  const expand = screen.getByRole('button', { name: 'Rozbalit 123' });
  expect(expand).toHaveTextContent('+');
  expect(expand).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('button', { name: 'Výkop základů' })).toBeVisible();
  fireEvent.click(expand);
  expect(screen.getByText('3*4')).toBeVisible();
  expect(screen.getByText('Poznámka k výkopu')).toBeVisible();
  expect(screen.queryByRole('button', { name: /(?:Sbalit|Rozbalit) 456/ })).not.toBeInTheDocument();
});
it('remeasures mounted rows when wrapping changes so details cannot overlap the item', () => {
  const { rerender } = render(table());
  const assertNoOverlap = () => {
    let expectedTop = 0;
    for (const row of screen.getAllByRole('row').filter(row => row.hasAttribute('data-index'))) {
      expect(row.style.transform).toBe(`translateY(${expectedTop}px)`);
      expectedTop += row.offsetHeight;
    }
  };
  assertNoOverlap();
  fireEvent.scroll(screen.getByRole('button', { name: '3*4' }).closest('.tf-budget-scroll')!, { target: { scrollTop: 10 } });
  rerender(table(true, true, true));
  assertNoOverlap();
  rerender(table(true, true, true, 60));
  assertNoOverlap();
  rerender(table(true, true, true, 44));
  assertNoOverlap();
  rerender(table());
  assertNoOverlap();
});

it('collapses and expands every level from the context menu without changing filters or selection', () => {
  const group = { ...item, quantity: null, unitPrice: null, total: null };
  const tree: BudgetNode[] = [
    { ...group, id: 'object', kind: 'object', code: '', description: 'Objekt školy', parentId: null },
    { ...group, id: 'sheet', kind: 'sheet', code: '', description: 'Stavební práce', parentId: 'object' },
    { ...group, id: 'section', kind: 'section', code: '', description: 'Základy', parentId: 'sheet' },
    ...nodes.map(node => node.parentId ? node : { ...node, parentId: 'section' }),
  ];
  const onFilters = vi.fn(); const onSelected = vi.fn();
  render(<BudgetTable {...table().props} nodes={tree} filters={{ code: { search: '123' } }} selected={new Set(['item'])} onFilters={onFilters} onSelected={onSelected}/>);
  const target = screen.getByRole('button', { name: 'Výkop základů' });
  fireEvent.contextMenu(target, { clientX: 150, clientY: 180 });
  expect(screen.getByRole('menu', { name: 'Akce rozpočtu' })).toBeVisible();
  expect(onFilters).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Sbalit vše' }));
  expect(screen.getByRole('button', { name: 'Rozbalit Objekt školy' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('button', { name: 'Výkop základů' })).not.toBeInTheDocument();
  // All levels are collapsed, including groups hidden by the top-level object.
  fireEvent.click(screen.getByRole('button', { name: 'Rozbalit Objekt školy' }));
  expect(screen.getByRole('button', { name: 'Rozbalit Stavební práce' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Stavební práce', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Rozbalit Základy' }));
  expect(screen.getByRole('button', { name: 'Rozbalit 123' })).toBeVisible();
  expect(screen.queryByRole('button', { name: '3*4' })).not.toBeInTheDocument();
  fireEvent.contextMenu(screen.getByRole('region', { name: 'Položky rozpočtu' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Rozbalit vše' }));
  expect(screen.getByRole('button', { name: 'Výkop základů' })).toBeVisible();
  expect(screen.getByRole('button', { name: '3*4' })).toBeVisible();
  expect(screen.getByRole('checkbox', { name: 'Vybrat 123' })).toBeChecked();
  expect(screen.queryByRole('button', { name: 'Neoceněná práce' })).not.toBeInTheDocument();
  expect(onFilters).not.toHaveBeenCalled(); expect(onSelected).not.toHaveBeenCalled();
});

it('retains explicit value filtering and supports keyboard and outside dismissal', () => {
  const onFilters = vi.fn();
  render(<BudgetTable {...table().props} onFilters={onFilters}/>);
  const target = screen.getByRole('button', { name: 'Výkop základů' });
  fireEvent.contextMenu(target);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Filtrovat podle této hodnoty' }));
  expect(onFilters).toHaveBeenCalledWith({ description: { selected: ['Výkop základů'] } });
  const region = screen.getByRole('region', { name: 'Položky rozpočtu' });
  fireEvent.keyDown(region, { key: 'F10', shiftKey: true });
  expect(screen.getByRole('menuitem', { name: 'Sbalit vše' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
  expect(screen.getByRole('menuitem', { name: 'Rozbalit vše' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument(); expect(region).toHaveFocus();
  fireEvent.contextMenu(target);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  fireEvent.contextMenu(target);
  fireEvent.scroll(window);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Kód ▾' }));
  fireEvent.contextMenu(screen.getByRole('textbox', { name: 'Hledat Kód' }));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it('opens focused column search from the compact heading and preserves the other filters', () => {
  function Harness() {
    const [filters, setFilters] = React.useState<BudgetFilters>({ quantity: { min: '1' } });
    return <BudgetTable {...table().props} filters={filters} onFilters={setFilters}/>;
  }
  render(<Harness/>);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: 'Popis ▾' });
  trigger.focus();
  fireEvent.click(trigger);
  const search = screen.getByRole('textbox', { name: 'Hledat Popis' });
  expect(search).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  fireEvent.change(search, { target: { value: 'výkop' } });
  fireEvent.click(screen.getByRole('button', { name: 'Hotovo' }));
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('button', { name: 'Výkop základů' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Neoceněná práce' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Množství ▾' }));
  expect(screen.getByRole('textbox', { name: 'Hledat Množství' })).toHaveFocus();
  expect(screen.getByRole('textbox', { name: 'Od' })).toHaveValue('1');
  fireEvent.click(screen.getByRole('button', { name: 'Hotovo' }));
  fireEvent.click(trigger);
  expect(screen.getByRole('textbox', { name: 'Hledat Popis' })).toHaveValue('výkop');
  fireEvent.click(screen.getByRole('button', { name: 'Vymazat filtr' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hotovo' }));
  expect(screen.getByRole('button', { name: 'Neoceněná práce' })).toBeVisible();
});
it('expands VV only for the selected item and disables items without a quantity detail', () => {
  const second = { ...item, id: 'second', code: '789', description: 'Druhá položka' };
  render(<BudgetTable {...table(false).props} nodes={[...nodes, second, { ...nodes[2], id: 'second-vv', parentId: 'second', description: '5*6' }]}/>);
  const first = screen.getByRole('button', { name: 'Výkaz výměr: 123' });
  expect(first).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('button', { name: 'Výkaz výměr: 456' })).toBeDisabled();
  fireEvent.click(first);
  expect(screen.getByText('3*4')).toBeVisible();
  expect(screen.queryByText('5*6')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Výkaz výměr: 789' }));
  expect(screen.getByText('5*6')).toBeVisible();
  fireEvent.click(first);
  expect(screen.queryByText('3*4')).not.toBeInTheDocument();
  expect(screen.getByText('5*6')).toBeVisible();
});
it('keeps per-item VV usable after collapsing all groups', () => {
  render(table(false));
  fireEvent.contextMenu(screen.getByRole('region', { name: 'Položky rozpočtu' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Sbalit vše' }));
  fireEvent.click(screen.getByRole('button', { name: 'Výkaz výměr: 123' }));
  expect(screen.getByText('3*4')).toBeVisible();
});
it.each(['3*4','Poznámka k výkopu'])('does not offer a priced-item filter on auxiliary row %s', text => {
 render(<BudgetTable {...table().props} showNotes/>);
 fireEvent.contextMenu(screen.getByRole('button',{name:text,exact:true}));
 expect(screen.queryByRole('menuitem',{name:'Filtrovat podle této hodnoty'})).not.toBeInTheDocument();
 expect(screen.getByRole('menu',{name:'Akce rozpočtu'})).toBeVisible();
});
it('disables recalculation until every referenced figure is resolved', () => {
 const props={...table().props,editable:true,nodes:[item,{...nodes[2],description:'F1*2 = 6 [A]'}]};
 const {rerender}=render(<BudgetTable {...props} figures={{}}/>);
 fireEvent.contextMenu(screen.getByRole('button',{name:item.description}));
 fireEvent.click(screen.getByRole('menuitem',{name:'Detail položky'}));
 expect(screen.getByRole('button',{name:'Přepočítat výraz a připravit množství'})).toBeDisabled();
 expect(screen.getByText(/Přepočet není dostupný/)).toHaveTextContent('F1');
 expect(screen.getByRole('textbox',{name:'Množství'})).toHaveValue('12');
 rerender(<BudgetTable {...props} figures={{F1:'3'}}/>);
 fireEvent.click(screen.getByRole('button',{name:'Přepočítat výraz a připravit množství'}));
 expect(screen.getByRole('textbox',{name:'Množství'})).toHaveValue('6');
});

it('selects a row on one click and extends selection with modifiers without opening an editor', () => {
  function Harness() { const [selected, setSelected] = React.useState(new Set<string>()); return <BudgetTable {...table().props} editable selected={selected} onSelected={setSelected}/>; }
  render(<Harness/>);
  fireEvent.click(screen.getByRole('button', { name: item.description }));
  expect(screen.getByRole('checkbox', { name: 'Vybrat 123' })).toBeChecked();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Neoceněná práce' }), { metaKey: true });
  expect(screen.getByRole('checkbox', { name: 'Vybrat 123' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Vybrat 456' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: item.description }));
  expect(screen.getByRole('checkbox', { name: 'Vybrat 456' })).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Neoceněná práce' }), { shiftKey: true });
  expect(screen.getByRole('checkbox', { name: 'Vybrat 123' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Vybrat 456' })).toBeChecked();
});
it('edits only the double-clicked cell, saves on Enter and cancels on Escape', async () => {
  const onEdit = vi.fn().mockResolvedValue(undefined);
  render(<BudgetTable {...table().props} editable onEdit={onEdit}/>);
  const row = screen.getByRole('button', { name: item.description }).closest('[role="row"]') as HTMLElement;
  fireEvent.doubleClick(within(row).getByText('12'));
  const input = screen.getByRole('textbox', { name: 'Upravit Množství' });
  expect(row).toContainElement(input);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: '15' } });
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
  await vi.waitFor(() => expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'item', quantity: '15', total: '150.00' }), ['quantity','total']));
  fireEvent.doubleClick(screen.getByRole('button', { name: item.description }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Upravit Popis' }), { target: { value: 'Neuložit' } });
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Upravit Popis' }), { key: 'Escape' });
  expect(onEdit).toHaveBeenCalledTimes(1);
});
it('keeps untouched price errors when only the full detail description changes',async()=>{
 const onEdit=vi.fn().mockResolvedValue(undefined);
 render(<BudgetTable {...table().props} nodes={[{...item,unitPrice:null,total:null}]} editable onEdit={onEdit}/>);
 fireEvent.contextMenu(screen.getByRole('button',{name:item.description}));
 fireEvent.click(screen.getByRole('menuitem',{name:'Detail položky'}));
 fireEvent.change(screen.getByLabelText('Úplný popis'),{target:{value:'Jiný popis'}});
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Uložit změnu'}));});
 await vi.waitFor(()=>expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({description:'Jiný popis',unitPrice:null,total:null}),['description']));
});

it('does not mark an unchanged unpriced total as repaired when saving quantity', async () => {
  const unpriced = { ...item, unitPrice: null, total: null };
  const document: BudgetDocument = { schemaVersion: 1, figures: {}, nodes: [unpriced],
    sheets: [{ id: 's', name: 'Soupis', columns: { quantity: 4, unitPrice: 5, total: 6 } } as BudgetDocument['sheets'][number]],
    issues: [{ sheet: 'Soupis', row: 1, severity: 'error', message: 'Neplatná nebo chybějící hodnota G.' }] };
  const onEdit = vi.fn(async (edited: BudgetNode, fields?: readonly string[]) => {
    expect(applyBudgetItemEdit(document, edited, fields).issues).toEqual(document.issues);
  });
  render(<BudgetTable {...table().props} nodes={[unpriced]} editable onEdit={onEdit}/>);
  const row = screen.getByRole('button', { name: item.description }).closest('[role="row"]') as HTMLElement;
  fireEvent.doubleClick(within(row).getByText('12'));
  await act(async () => { fireEvent.keyDown(screen.getByRole('textbox', { name: 'Upravit Množství' }), { key: 'Enter' }); });
  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ quantity: '12', total: null }), ['quantity']);
});

it('shows notes separately from VV and labels them as notes', () => {
 const {rerender}=render(table(false));
 fireEvent.click(screen.getByRole('button',{name:'Výkaz výměr: 123'}));
 expect(screen.getByText('3*4')).toBeVisible();
 expect(screen.queryByText('Poznámka k výkopu')).not.toBeInTheDocument();
 rerender(<BudgetTable {...table(false).props} showNotes/>);
 expect(screen.getByText('Poznámka k výkopu')).toBeVisible();
 expect(screen.getByText('Poznámka')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Výkaz výměr: 123'}));
 expect(screen.queryByText('3*4')).not.toBeInTheDocument();
 expect(screen.getByText('Poznámka k výkopu')).toBeVisible();
 rerender(<BudgetTable {...table(false).props} showNotes={false}/>);
 expect(screen.queryByText('Poznámka k výkopu')).not.toBeInTheDocument();
});
it('disables VV for an item with only notes',()=>{
 render(<BudgetTable {...table(false).props} nodes={[item,nodes[1]]} showNotes/>);
 expect(screen.getByRole('button',{name:'Výkaz výměr: 123'})).toBeDisabled();
 expect(screen.getByText('Poznámka k výkopu')).toBeVisible();
});

it('expands tender assignment in the item column without a dialog', async () => {
  const onAllocate = vi.fn().mockResolvedValue(undefined);
  render(<BudgetTable {...table(false).props} editable canAllocate categories={[{id:'t1',title:'Zemní práce'}]} onAllocate={onAllocate}/>);
  const row = screen.getByRole('button', {name:item.description}).closest('[role="row"]') as HTMLElement;
  fireEvent.click(within(row).getByRole('button', {name:'VŘ: 123'}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.change(within(row).getByRole('combobox', {name:'Cílové VŘ'}), {target:{value:'t1'}});
  expect(screen.queryByRole('textbox',{name:'Množství do VŘ'})).not.toBeInTheDocument();
  await act(async()=>{fireEvent.click(within(row).getByRole('button', {name:'Přiřadit VŘ'}));});
  expect(onAllocate).toHaveBeenCalledWith('item','t1');
});
it('retains a failed inline edit and blocks duplicate submissions', async () => {
  let reject!: (error: Error) => void;
  const onEdit = vi.fn(() => new Promise<void>((_, fail) => { reject = fail; }));
  render(<BudgetTable {...table().props} editable onEdit={onEdit}/>);
  fireEvent.doubleClick(screen.getByRole('button', {name:item.description}));
  const input=screen.getByRole('textbox',{name:'Upravit Popis'});
  fireEvent.change(input,{target:{value:'Opravený popis'}});
  fireEvent.keyDown(input,{key:'Enter'});fireEvent.keyDown(input,{key:'Enter'});
  expect(onEdit).toHaveBeenCalledTimes(1);
  await act(async()=>reject(new Error('Konflikt verze')));
  expect(input).toHaveValue('Opravený popis');
  expect(screen.getByRole('alert')).toHaveTextContent('Konflikt verze');
});
it('keeps tender assignments readable without permitting writes', () => {
  const onAllocate=vi.fn();
  render(<BudgetTable {...table().props} canAllocate onAllocate={onAllocate} categories={[{id:'t',title:'Zemní práce'}]} allocations={[{itemId:item.id,categoryId:'t',quantity:'4'}]}/>);
  fireEvent.click(screen.getByRole('button',{name:'VŘ: 123'}));
  expect(screen.getByText('Zemní práce · 4 m3')).toBeVisible();
  expect(screen.queryByRole('combobox',{name:'Cílové VŘ'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Přiřadit VŘ'})).not.toBeInTheDocument();
});
it.each([['kind','Typ','M'],['total','Celkem (Kč)','175']])('saves %s directly in its cell', async (key,label,value) => {
  const onEdit=vi.fn().mockResolvedValue(undefined);
  render(<BudgetTable {...table().props} editable onEdit={onEdit}/>);
  const row=screen.getByRole('button',{name:item.description}).closest('[role="row"]') as HTMLElement;
  fireEvent.doubleClick(within(row).getByText(key==='kind'?'K':'120,00'));
  const input=screen.getByLabelText(`Upravit ${label}`);
  fireEvent.change(input,{target:{value}});
  await act(async()=>fireEvent.keyDown(input,{key:'Enter'}));
  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({[key]:value}),[key]);
});
it('persists tag identifiers and kind without replacing tags with display labels', async () => {
  let saved: BudgetDocument = {schemaVersion:1,nodes:[{...item,tags:['tag-1']}],sheets:[],issues:[],figures:{}};
  const onEdit=vi.fn(async (edited:BudgetNode,fields?:readonly string[])=>{saved=applyBudgetItemEdit(saved,edited,fields);});
  render(<BudgetTable {...table().props} nodes={[{...item,tags:['Původní']}]} editable tagOptions={[{id:'tag-1',name:'Původní'},{id:'tag-2',name:'Nový'}]} itemTags={{item:['tag-1']}} onEdit={onEdit}/>);
  fireEvent.doubleClick(screen.getByText('Původní'));
  const input=screen.getByRole('listbox',{name:'Upravit Štítky'});
  fireEvent.change(input,{target:{value:'tag-2'}});
  await act(async()=>fireEvent.keyDown(input,{key:'Enter'}));
  expect(saved.nodes[0].tags).toEqual(['tag-2']);
  const row=screen.getByRole('button',{name:item.description}).closest('[role="row"]') as HTMLElement;
  fireEvent.doubleClick(within(row).getByText('K'));
  fireEvent.change(screen.getByLabelText('Upravit Typ'),{target:{value:'M'}});
  await act(async()=>fireEvent.keyDown(screen.getByLabelText('Upravit Typ'),{key:'Enter'}));
  expect(saved.nodes[0]).toMatchObject({kind:'M',tags:['tag-2']});
});
it('filters a long tender list immediately while choosing', async () => {
  const categories=Array.from({length:60},(_,i)=>({id:`t${i}`,title:`Řízení ${i}`}));
  render(<BudgetTable {...table().props} editable canAllocate categories={categories} onAllocate={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'VŘ: 123'}));
  fireEvent.click(screen.getByRole('combobox',{name:'Cílové VŘ'}));
  const search=screen.getByRole('searchbox',{name:'Hledat v nabídce Cílové VŘ'});
  await vi.waitFor(()=>expect(search).toHaveFocus());
  fireEvent.change(search,{target:{value:'Řízení 59'}});
  const list=screen.getByRole('listbox',{name:'Cílové VŘ'});
  expect(within(list).getAllByRole('option')).toHaveLength(1);
  fireEvent.click(within(list).getByRole('option',{name:'Řízení 59'}));
  expect(screen.getByRole('combobox',{name:'Cílové VŘ'})).toHaveTextContent('Řízení 59');
});
it('creates a tender in the row and assigns the whole item without an extra dialog', async () => {
  const onCreateTender=vi.fn().mockResolvedValue({id:'new',title:'Nové práce'});
  const onAllocate=vi.fn().mockResolvedValue(undefined);
  render(<BudgetTable {...table().props} editable canAllocate onAllocate={onAllocate} onCreateTender={onCreateTender}/>);
  fireEvent.click(screen.getByRole('button',{name:'VŘ: 123'}));
  fireEvent.click(screen.getByRole('button',{name:'Nové VŘ'}));
  fireEvent.change(screen.getByLabelText('Název nového VŘ'),{target:{value:'Nové práce'}});
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Vytvořit a přiřadit'})));
  expect(onCreateTender).toHaveBeenCalledWith('Nové práce');
  expect(onAllocate).toHaveBeenCalledWith('item','new');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Množství do VŘ')).not.toBeInTheDocument();
});
it('keeps the newly created tender selectable if assignment fails', async () => {
  const onCreateTender=vi.fn().mockResolvedValue({id:'new',title:'Nové práce'});
  const onAllocate=vi.fn().mockRejectedValue(new Error('Konflikt verze'));
  render(<BudgetTable {...table().props} editable canAllocate onAllocate={onAllocate} onCreateTender={onCreateTender}/>);
  fireEvent.click(screen.getByRole('button',{name:'VŘ: 123'}));fireEvent.click(screen.getByRole('button',{name:'Nové VŘ'}));
  fireEvent.change(screen.getByLabelText('Název nového VŘ'),{target:{value:'Nové práce'}});
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Vytvořit a přiřadit'})));
  expect(screen.getByRole('alert')).toHaveTextContent('Konflikt verze');
  expect(screen.getByRole('combobox',{name:'Cílové VŘ'})).toHaveTextContent('Nové práce');
});
