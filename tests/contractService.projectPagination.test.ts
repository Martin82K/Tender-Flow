import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ page: vi.fn(), calls: [] as { table: string; filter: [string, unknown]; start: number; end: number }[] }));
vi.mock('@/services/supabase', () => ({ supabase: { from: (table: string) => {
  let filter: [string, unknown] = ['', null];
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { filter = [key, value]; return query; },
    in: (key: string, value: unknown) => { filter = [key, value]; return query; },
    order: () => query,
    range: (start: number, end: number) => { mocks.calls.push({ table, filter, start, end }); return mocks.page(table, filter, start, end); },
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mocks.page(table, filter, 0, 499).then(resolve, reject),
  };
  return query;
} } }));
vi.mock('@/services/functionsClient', () => ({ invokeAuthedFunction: vi.fn() }));
import { contractService } from '@/services/contractService';
const contract = (i: number) => ({ id: `c${i}`, project_id: 'p1', title: `Contract ${i}`, base_price: '10', currency: 'CZK', status: 'active' });
beforeEach(() => {
  vi.clearAllMocks(); mocks.calls = [];
  mocks.page.mockImplementation(async (table: string, filter: [string, unknown], start: number, end: number) => {
    if (table === 'contracts') return { data: Array.from({ length: Math.max(0, Math.min(end + 1, 1001) - start) }, (_, i) => contract(i + start)), error: null };
    const ids = filter[1] as string[];
    if (!ids.includes('c1000')) return { data: [], error: null };
    return { data: Array.from({ length: Math.max(0, Math.min(end + 1, 1001) - start) }, (_, i) => ({ id: `${table}-${start + i}`, contract_id: 'c1000', delta_price: '1', approved_amount: '1', amount: '1', status: 'paid' })), error: null };
  });
});
it('loads a contract beyond the first server page with complete related metadata and bounded queries', async () => {
  const contracts = await contractService.getContractsByProject('p1');
  expect(contracts).toHaveLength(1001);
  const target = contracts.find(item => item.id === 'c1000');
  expect(target?.title).toBe('Contract 1000');
  expect(target?.amendments).toHaveLength(1001);
  expect(target?.invoices).toHaveLength(1001);
  expect(target?.drawdowns).toHaveLength(1001);
  expect(target?.currentTotal).toBe(1011);
  expect(mocks.calls.filter(call => call.table === 'contracts').map(call => [call.filter, call.start, call.end])).toEqual([
    [['project_id', 'p1'], 0, 499], [['project_id', 'p1'], 500, 999], [['project_id', 'p1'], 1000, 1499],
  ]);
  expect(mocks.calls.filter(call => call.table !== 'contracts').every(call => (call.filter[1] as string[]).length <= 100)).toBe(true);
});
it.each(['contracts', 'contract_invoices'])('rejects an incomplete later %s page instead of opening partial data', async (failedTable) => {
  const original = mocks.page.getMockImplementation()!;
  mocks.page.mockImplementation((table: string, filter: [string, unknown], start: number, end: number) => table === failedTable && start === 500 ? Promise.resolve({ data: null, error: new Error('failed later page') }) : original(table, filter, start, end));
  await expect(contractService.getContractsByProject('p1')).rejects.toThrow('failed later page');
});
it('discards contract and related rows outside the requested project and contract IDs', async () => {
  mocks.page.mockImplementation(async (table: string) => ({ data: table === 'contracts' ? [contract(1), { ...contract(2), project_id: 'other' }] : [{ id: 'foreign', contract_id: 'c2', amount: 9000 }, { id: 'own', contract_id: 'c1', delta_price: '1', approved_amount: '1', amount: '1', status: 'paid' }], error: null }));
  const contracts = await contractService.getContractsByProject('p1');
  expect(contracts.map(item => item.id)).toEqual(['c1']);
  expect(contracts[0].invoices.map(item => item.id)).toEqual(['own']);
});
