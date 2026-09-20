import { expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { exportBudget } from '@features/projects/budget/api/budgetExport';
import { remainingQuantity } from '@features/projects/budget/model/budgetModel';
import type { BudgetNode } from '@features/projects/budget/model/types';
vi.mock('xlsx', async importOriginal => ({ ...await importOriginal<typeof import('xlsx')>(), writeFile: vi.fn() }));
it('exports exact decimals as text and never turns descriptions into formulas', () => {
  const node = { kind: 'K', code: '=1+1', description: '+cmd', unit: 'm', quantity: '999999999999999999999999.123456789012345678', unitPrice: '0.123456789012345678', total: '123.00', tags: [], tenders: [] } as unknown as BudgetNode;
  exportBudget([node], 'budget.xlsx');
  const workbook = vi.mocked(XLSX.writeFile).mock.calls[0][0];
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  expect(sheet.E2).toMatchObject({ t: 's', v: node.quantity });
  expect(sheet.F2).toMatchObject({ t: 's', v: node.unitPrice });
  expect(sheet.B2).toMatchObject({ t: 's', v: '=1+1' });
  expect(sheet.B2.f).toBeUndefined();
});
it('allocates only the exact remaining signed quantity', () => {
  expect(remainingQuantity('10.000000000000000001', ['4', '6'])).toBe('0.000000000000000001');
  expect(remainingQuantity('-10', ['-4'])).toBe('-6');
  expect(remainingQuantity('10', ['10'])).toBe('0');
  expect(() => remainingQuantity('10', ['11'])).toThrow();
});

it('rejects decimal and calculated amounts outside the server contract', async () => {
  const { decimal, multiplyMoney } = await import('@features/projects/budget/model/budgetModel');
  expect(decimal('999999999999999999999999.123456789012345678')).toBe('999999999999999999999999.123456789012345678');
  expect(() => decimal('1000000000000000000000000')).toThrow();
  expect(() => multiplyMoney('999999999999999999999999', '2')).toThrow();
});
it('skips fully assigned items instead of introducing zero-quantity category links', async () => {
  const { createRemainingAllocations } = await import('@features/projects/budget/model/revisions');
  const nodes = [{ id: 'full', kind: 'K', quantity: '10' }, { id: 'partial', kind: 'K', quantity: '10' }] as BudgetNode[];
  expect(createRemainingAllocations(nodes, [{ itemId: 'full', categoryId: 'a', quantity: '10' }, { itemId: 'partial', categoryId: 'a', quantity: '4' }], new Set(['full', 'partial']), 'b')).toEqual([{ itemId: 'partial', categoryId: 'b', quantity: '6' }]);
  expect(createRemainingAllocations(nodes, [], new Set(['full']), 'b', '0')).toEqual([]);
});
it('renders aggregate totals beyond the per-item input limit', async () => {
 const { sumMoney, formatBudgetNumber } = await import('@features/projects/budget/model/budgetModel');
 const total=sumMoney(['999999999999999999999999','1']);
 expect(total).toBe('1000000000000000000000000.00');
 expect(formatBudgetNumber(total,true)).toContain('1');
});
it('clears overflow issues when the item is corrected', async () => {
 const { applyBudgetItemEdit }=await import('@features/projects/budget/model/revisions');
 const node={id:'a',kind:'K',source:{sheet:'s',row:1},quantity:'2',unitPrice:'3',total:'6'} as BudgetNode;
 const document={nodes:[node],issues:[{sheet:'s',row:1,severity:'error',message:'Množství × jednotková cena přesahuje limit 24 číslic.'}]} as import('@features/projects/budget/model/types').BudgetDocument;
 expect(applyBudgetItemEdit(document,node).issues).toEqual([]);
});
