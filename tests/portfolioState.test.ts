import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_PORTFOLIO, readPortfolioState, writePortfolioState } from '@features/projects/model/portfolioState';
describe('Portfolio state', () => {
  beforeEach(() => sessionStorage.clear());
  it('restores filters and scroll only for the same scoped key', () => {
    const state = { query: 'most', status: 'tender' as const, ownOnly: true, scrollTop: 250 };
    writePortfolioState('organization-a:user-a', state);
    expect(readPortfolioState('organization-a:user-a')).toEqual(state);
    expect(readPortfolioState('organization-b:user-a')).toEqual(EMPTY_PORTFOLIO);
  });
  it('ignores malformed and invalid browser data', () => {
    sessionStorage.setItem('test', '{');
    expect(readPortfolioState('test')).toEqual(EMPTY_PORTFOLIO);
    sessionStorage.setItem('test', JSON.stringify({ query: 123, status: 'other', ownOnly: 'yes', scrollTop: -10 }));
    expect(readPortfolioState('test')).toEqual(EMPTY_PORTFOLIO);
  });
});
