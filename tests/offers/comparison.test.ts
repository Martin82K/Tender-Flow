import { describe, expect, it } from 'vitest';
import { matchOfferItems, compareOffer, validateAssignments } from '../../shared/offers/comparison.js';
const item = (id: string, overrides = {}) => ({ id, code: '6123', description: 'Vnitřní omítka', unit: 'm²', quantity: '120', unitPrice: '320', total: '38400', group: 'SO 01', source: { sheet: 'Nabídka', row: 2 }, ...overrides });
describe('supplier offer comparison', () => {
  it('matches independently of row order and preserves original data', () => {
    const base = [item('a'), item('b', { code: '7842', description: 'Malba' })];
    const offers = [item('y', { code: '7842', description: 'Malba' }), item('x')];
    const before = JSON.stringify({ base, offers });
    expect(matchOfferItems(base, offers).map(r => r.offerId)).toEqual(['x', 'y']);
    expect(JSON.stringify({ base, offers })).toBe(before);
  });
  it('does not guess between identical codes in different objects', () => {
    const result = matchOfferItems([item('a', { group: '' })], [item('x'), item('y', { group: 'SO 02' })]);
    expect(result[0].status).toBe('review');
    expect(result[0].offerId).toBeNull();
  });
  it('uses the object context to disambiguate duplicate codes', () => {
    expect(matchOfferItems([item('a')], [item('x'), item('y', { group: 'SO 02' })])[0].offerId).toBe('x');
  });
  it.each([{ quantity: '66' }, { unit: 'm3' }, { description: 'Vnější omítka' }])('requires review for conflicting evidence %j', diff => {
    expect(matchOfferItems([item('a')], [item('x', diff)])[0].status).toBe('review');
  });
  it('does not reuse a single offer row for duplicate inquiry rows', () => {
    expect(matchOfferItems([item('a'), item('b')], [item('x')]).every(r => r.status === 'review')).toBe(true);
  });
  it('distinguishes zero price, absent price and absent match', () => {
    const base = [item('a'), item('b', { code: '2' }), item('c', { code: '3' })];
    const offers = [item('x', { unitPrice: '0', total: '0' }), item('y', { code: '2', unitPrice: null, total: null })];
    const result = compareOffer(base, offers, matchOfferItems(base, offers));
    expect(result.rows.map(r => r.priceStatus)).toEqual(['priced', 'missing-price', 'unmatched']);
    expect(result.pricedCount).toBe(1);
    expect(result.total).toBe('0.00');
    expect(result.complete).toBe(false);
  });
  it('never scales quoted totals silently to a different quantity', () => {
    const a = [item('a')], b = [item('x', { quantity: '66', total: '21120' })];
    const assignments = [{ baseId: 'a', offerId: 'x', status: 'manual', candidates: ['x'], reasons: [] }];
    expect(compareOffer(a, b, assignments).rows[0].comparableTotal).toBeNull();
  });
  it('rejects duplicate identities, foreign assignments and reuse', () => {
    expect(() => matchOfferItems([item('a'), item('a')], [])).toThrow();
    expect(() => validateAssignments([item('a')], [item('x')], [{ baseId: 'a', offerId: 'z', status: 'manual' }])).toThrow();
    expect(() => validateAssignments([item('a'), item('b')], [item('x')], [{ baseId: 'a', offerId: 'x', status: 'manual' }, { baseId: 'b', offerId: 'x', status: 'manual' }])).toThrow();
  });
  it('retains unmatched offer rows as extras, not missing inquiry prices', () => {
    const base = [item('a')], offers = [item('x'), item('extra', { code: 'VL', description: 'Doprava' })];
    expect(compareOffer(base, offers, matchOfferItems(base, offers)).extraIds).toEqual(['extra']);
  });
});
