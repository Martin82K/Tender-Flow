import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BudgetRecap } from '@features/projects/budget/ui/BudgetRecap';
import { budgetRecapTree } from '@features/projects/budget/model/budgetTree';
import type { BudgetNode } from '@features/projects/budget/model/types';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(360);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const node = (id: string, parentId: string | null, kind: BudgetNode['kind'], description: string): BudgetNode => ({
  id, parentId, kind, description, order: 0, sheetId: 'sheet', code: '', unit: '', quantity: null, unitPrice: null, total: null,
  source: { sheet: 'Soupis', row: 1, cells: {} }, sourceType: '', tags: [], tenders: [],
});
const nodes = [node('object', null, 'object', 'Škola'), node('sheet', 'object', 'sheet', 'Stavební práce'),
  node('hsv', 'sheet', 'section', 'HSV'), node('earth', 'hsv', 'section', 'Zemní práce'),
  { ...node('item', 'earth', 'K', 'Výkop'), quantity: '2', unitPrice: '50', total: '100' },
  node('walls', 'hsv', 'section', 'Zdivo'), node('other', 'object', 'sheet', 'Elektro')];

it('defers viewport resize rendering until the next frame to avoid a ResizeObserver feedback loop', () => {
  const observers: Array<{ callback: ResizeObserverCallback; target?: Element }> = [];
  vi.stubGlobal('ResizeObserver', class {
    record: { callback: ResizeObserverCallback; target?: Element };
    constructor(callback: ResizeObserverCallback) { this.record = { callback }; observers.push(this.record); }
    observe(target: Element) { this.record.target = target; }
    unobserve() {}
    disconnect() {}
  });
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  render(<BudgetRecap nodes={Array.from({ length: 100 }, (_, index) => node(`n${index}`, null, 'object', `Objekt ${index}`))} prices onJump={vi.fn()}/>);
  const before = screen.getAllByRole('treeitem').length;
  const observer = observers.find(entry => entry.target === screen.getByRole('tree'))!;
  const entry = { target: observer.target, borderBoxSize: [{ inlineSize: 360, blockSize: 2000 }] } as unknown as ResizeObserverEntry;
  act(() => observer.callback([entry], {} as ResizeObserver));
  expect(screen.getAllByRole('treeitem')).toHaveLength(before);
  act(() => { frames.splice(0).forEach(callback => callback(16)); });
  expect(screen.getAllByRole('treeitem').length).toBeGreaterThan(before);
});

it('renders the budget hierarchy with expansion controls only on branches and unchanged totals', () => {
  render(<BudgetRecap nodes={nodes} prices onJump={vi.fn()}/>);
  const tree = screen.getByRole('tree', { name: 'Strom rozpočtu' });
  expect(within(tree).getAllByRole('treeitem').map(row => row.getAttribute('aria-level'))).toEqual(['1', '2', '3', '4', '4', '2']);
  expect(screen.queryByRole('button', { name: 'Sbalit Zemní práce' })).not.toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Cena celkem' })).getByText('100,00 Kč')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Sbalit HSV' }));
  expect(screen.queryByRole('treeitem', { name: 'Zemní práce' })).not.toBeInTheDocument();
  expect(screen.getByRole('treeitem', { name: 'HSV' })).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Rozbalit HSV' }));
  expect(screen.getByRole('treeitem', { name: 'Zemní práce' })).toBeVisible();
});

it('finds a chapter inside collapsed branches with its ancestors and restores the previous collapse state', () => {
  render(<BudgetRecap nodes={nodes} prices onJump={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Sbalit Škola' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Hledat oddíl' }), { target: { value: 'zemni' } });
  expect(screen.getAllByRole('treeitem').map(row => row.getAttribute('aria-label'))).toEqual(['Škola', 'Stavební práce', 'HSV', 'Zemní práce']);
  fireEvent.change(screen.getByRole('textbox', { name: 'Hledat oddíl' }), { target: { value: '' } });
  expect(screen.getAllByRole('treeitem')).toHaveLength(1);
  expect(within(screen.getByRole('region', { name: 'Cena celkem' })).getByText('100,00 Kč')).toBeVisible();
});

it('selects and revisits a chapter without navigating when its branch toggle is clicked', () => {
  const onJump = vi.fn();
  render(<BudgetRecap nodes={nodes} prices onJump={onJump}/>);
  fireEvent.click(screen.getByRole('treeitem', { name: 'Zemní práce' }));
  expect(onJump).toHaveBeenLastCalledWith(nodes[3]);
  expect(screen.getByRole('treeitem', { name: 'Zemní práce' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.click(screen.getByRole('treeitem', { name: 'Zemní práce' }));
  expect(onJump).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Sbalit HSV' }));
  expect(onJump).toHaveBeenCalledTimes(2);
});

it('collapses and expands all from the context menu and supports keyboard navigation', () => {
  const onJump = vi.fn();
  render(<BudgetRecap nodes={nodes} prices onJump={onJump}/>);
  fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'HSV' }), { clientX: 30, clientY: 50 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Sbalit vše' }));
  expect(screen.getAllByRole('treeitem')).toHaveLength(1);
  fireEvent.keyDown(screen.getByRole('treeitem', { name: 'Škola' }), { key: 'ArrowRight' });
  expect(screen.getAllByRole('treeitem')).toHaveLength(3);
  fireEvent.keyDown(screen.getByRole('treeitem', { name: 'Škola' }), { key: 'F10', shiftKey: true });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Rozbalit vše' }));
  expect(screen.getAllByRole('treeitem')).toHaveLength(6);
  fireEvent.keyDown(screen.getByRole('tree'), { key: 'Home' });
  fireEvent.keyDown(screen.getByRole('tree'), { key: 'ArrowDown' });
  expect(screen.getByRole('tree')).toHaveAttribute('aria-activedescendant', screen.getByRole('treeitem', { name: 'Stavební práce' }).id);
  fireEvent.keyDown(screen.getByRole('treeitem', { name: 'Zemní práce' }), { key: 'Enter' });
  expect(onJump).toHaveBeenLastCalledWith(nodes[3]);
  fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'HSV' }));
  fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Sbalit vše' }), { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it('groups interleaved chapters by their parent and keeps each malformed chapter reachable once', () => {
  const tree = budgetRecapTree([nodes[3], nodes[6], nodes[0], nodes[5], nodes[2], nodes[1], nodes[4]]);
  expect(tree.map(entry => entry.node.id)).toEqual(['object', 'other', 'sheet', 'hsv', 'earth', 'walls']);
  const malformed = budgetRecapTree([node('a', 'b', 'section', 'A'), node('b', 'a', 'section', 'B'), node('orphan', 'missing', 'section', 'C')]);
  expect(new Set(malformed.map(entry => entry.node.id)).size).toBe(3);
  expect(malformed).toHaveLength(3);
});

it('never reveals prices without price permission, including during search', () => {
  render(<BudgetRecap nodes={nodes} prices={false} onJump={vi.fn()}/>);
  expect(screen.queryByText(/Kč/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Hledat oddíl' }), { target: { value: 'zemni' } });
  expect(screen.queryByText(/Kč/)).not.toBeInTheDocument();
  expect(screen.getByRole('treeitem', { name: 'Zemní práce' })).toBeVisible();
});


it('shows the whole budget total above search without counting group totals twice', () => {
  const priced = [...nodes.map(n => n.kind === 'object' ? { ...n, total: '100' } : n),
    { ...node('second', 'other', 'K', 'Kabel'), total: '25.50' }];
  const { rerender } = render(<BudgetRecap nodes={priced} prices onJump={vi.fn()}/>);
  const summary = screen.getByRole('region', { name: 'Cena celkem' });
  expect(within(summary).getByText('125,50 Kč')).toBeVisible();
  expect(within(summary).getByText('Celý rozpočet · bez DPH')).toBeVisible();
  expect(summary.compareDocumentPosition(screen.getByRole('textbox', { name: 'Hledat oddíl' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', { name: 'Hledat oddíl' }), { target: { value: 'zemni' } });
  expect(within(summary).getByText('125,50 Kč')).toBeVisible();
  fireEvent.change(screen.getByRole('textbox', { name: 'Hledat oddíl' }), { target: { value: 'nenalezeno' } });
  expect(within(summary).getByText('125,50 Kč')).toBeVisible();
  rerender(<BudgetRecap nodes={[...priced, { ...node('third', 'other', 'K', 'Světlo'), total: '4.50' }]} prices onJump={vi.fn()}/>);
  expect(within(summary).getByText('130,00 Kč')).toBeVisible();
  rerender(<BudgetRecap nodes={priced} prices={false} onJump={vi.fn()}/>);
  expect(screen.queryByRole('region', { name: 'Cena celkem' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Kč/)).not.toBeInTheDocument();
});

it('shows zero for an empty budget and keeps the warning for incomplete prices', () => {
  const { rerender } = render(<BudgetRecap nodes={[]} prices onJump={vi.fn()}/>);
  expect(within(screen.getByRole('region', { name: 'Cena celkem' })).getByText('0,00 Kč')).toBeVisible();
  rerender(<BudgetRecap nodes={[...nodes, node('missing', 'other', 'K', 'Bez ceny')]} prices onJump={vi.fn()}/>);
  expect(within(screen.getByRole('region', { name: 'Cena celkem' })).getByText('100,00 Kč')).toBeVisible();
  expect(screen.getByText('Neúplný součet. Některým položkám chybí cena.')).toBeVisible();
});


it('preserves the compact total in the items sidebar', () => {
  render(<BudgetRecap nodes={nodes} prices prominentTotal={false} onJump={vi.fn()}/>);
  expect(screen.queryByRole('region', { name: 'Cena celkem' })).not.toBeInTheDocument();
  expect(screen.getByText('Celý rozpočet · 100,00 Kč')).toBeVisible();
  expect(screen.getByRole('treeitem', { name: 'Zemní práce' })).toBeVisible();
});
