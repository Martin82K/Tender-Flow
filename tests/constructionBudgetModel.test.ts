import { describe, it, expect } from 'vitest';
import { decimal, money, multiplyMoney, sumMoney, filterItems, uniqueValues, validateAllocation, evaluateExpression } from '@features/projects/budget/model/budgetModel';

const items = Array.from({ length: 5000 }, (_, i) => ({ id: String(i), kind: 'K', code: `00${i}`, description: 'Položka', unit: 'm3', quantity: '10', unitPrice: '0.10', total: '1.00', tenders: i === 4999 ? ['Zemní práce', 'Základy'] : [], tags: [] }));
describe('construction budget domain', () => {
  it('distinguishes empty, zero and invalid decimals and rounds half away from zero', () => {
    expect(decimal('')).toBe(null); expect(decimal('0')).toBe('0'); expect(() => decimal('abc')).toThrow();
    expect(decimal('1 234,567')).toBe('1234.567'); expect(money('-1.005')).toBe('-1.01');
    expect(multiplyMoney('135.228', '6980')).toBe('943891.44');
    expect(sumMoney(['0.10', '0.20'])).toBe('0.30');
  });
  it('filters all rows beyond the viewport with accent-insensitive search and checkbox AND semantics', () => {
    expect(filterItems(items, { tenders: { search: 'ZEMNI' } })).toHaveLength(1);
    expect(filterItems(items, { tenders: { search: 'zem', selected: ['Základy'] } })).toHaveLength(1);
    expect(filterItems(items, { tenders: { selected: [] } })).toHaveLength(0);
    expect(filterItems(items, { tenders: { selected: [''] } })).toHaveLength(4999);
    expect(filterItems(items, { quantity: { min: '10,1' } })).toHaveLength(0);
    expect(uniqueValues(items, 'tenders', { tenders: { selected: [] } })).toEqual(['', 'Základy', 'Zemní práce']);
  });
  it('rejects overallocation and uses signed quantities consistently', () => {
    expect(() => validateAllocation('10', ['6', '4.001'])).toThrow();
    expect(() => validateAllocation('-10', ['-6', '-4'])).not.toThrow();
    expect(() => validateAllocation('-10', ['2'])).toThrow();
    expect(() => validateAllocation('0', ['1'])).toThrow();
  });
  it('evaluates only bounded arithmetic and known figures without executing code', () => {
    expect(evaluateExpression('ZKD01_01*0,1', { ZKD01_01: '1352.28' })).toBe('135.228');
    expect(() => evaluateExpression('unknown*2', {})).toThrow();
    expect(() => evaluateExpression('globalThis.alert(1)', {})).toThrow();
    expect(() => evaluateExpression('1/0', {})).toThrow();
  });
});
it('searches budget codes, descriptions and assignments across all rows',()=>{
 expect(filterItems(items, {$all:{search:'ZEMNI'}})).toHaveLength(1);
 expect(filterItems(items, {$all:{search:'004999'}})[0].id).toBe('4999');
 expect(filterItems(items, {$all:{search:'nenalezeno'}})).toHaveLength(0);
});
