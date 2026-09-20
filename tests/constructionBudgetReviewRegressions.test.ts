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
