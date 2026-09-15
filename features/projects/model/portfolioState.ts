export interface PortfolioState {
  query: string;
  status: 'all' | 'tender' | 'realization';
  ownOnly: boolean;
  scrollTop: number;
}
export const EMPTY_PORTFOLIO: PortfolioState = { query: '', status: 'all', ownOnly: false, scrollTop: 0 };
export function readPortfolioState(key: string): PortfolioState {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (!value || typeof value !== 'object') return { ...EMPTY_PORTFOLIO };
    return {
      query: typeof value.query === 'string' ? value.query : '',
      status: value.status === 'tender' || value.status === 'realization' ? value.status : 'all',
      ownOnly: value.ownOnly === true,
      scrollTop: Number.isFinite(value.scrollTop) && value.scrollTop >= 0 ? value.scrollTop : 0,
    };
  } catch { return { ...EMPTY_PORTFOLIO }; }
}
export function writePortfolioState(key: string, state: PortfolioState): void {
  try { sessionStorage.setItem(key, JSON.stringify(state)); } catch { /* Navigation works without browser storage. */ }
}
