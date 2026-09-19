import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BudgetTable, DEFAULT_COLUMNS } from '@features/projects/budget/ui/BudgetTable';
import type { BudgetNode } from '@features/projects/budget/model/types';

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
it('shows quantity details under their item without treating unpriced details as missing prices', () => {
  render(table());
  expect(screen.getAllByText('Chybí cena')).toHaveLength(1);
  const quantityRow = screen.getByRole('button', { name: '3*4' }).closest('[role="row"]')!;
  expect(within(quantityRow as HTMLElement).getByText('12')).toBeVisible();
  expect(within(quantityRow as HTMLElement).queryByRole('checkbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '3*4' }));
  expect(screen.getByRole('textbox', { name: 'Úplný popis' })).toHaveValue('3*4');
  expect(screen.queryByRole('button', { name: 'Uložit změnu' })).not.toBeInTheDocument();
});
it('hides quantity details through the existing switch and respects price visibility', () => {
  const { rerender } = render(table());
  rerender(table(false, false));
  expect(screen.queryByText('3*4')).not.toBeInTheDocument();
  expect(screen.queryByText('Poznámka k výkopu')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Výkop základů' })).toBeVisible();
  expect(screen.queryByText('Chybí cena')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Filtr J. cena' })).not.toBeInTheDocument();
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
