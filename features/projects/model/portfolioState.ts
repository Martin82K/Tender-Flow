export interface PortfolioState {
  query: string;
  status: 'all' | 'tender' | 'realization' | 'archived';
  ownOnly: boolean;
  scrollTop: number;
}
export const EMPTY_PORTFOLIO: PortfolioState = { query: '', status: 'all', ownOnly: false, scrollTop: 0 };
export const PORTFOLIO_VIEWS = [
  { id: 'all', label: 'Všechny', icon: 'apartment' },
  { id: 'tender', label: 'V soutěži', icon: 'gavel' },
  { id: 'realization', label: 'V realizaci', icon: 'construction' },
  { id: 'archived', label: 'Archiv', icon: 'inventory_2' },
] as const;
export function parsePortfolioStatus(value: string | null): PortfolioState['status'] | undefined {
  return PORTFOLIO_VIEWS.find(view => view.id === value)?.id;
}
export function portfolioStorageKey(userId?: string, organizationId?: string): string {
  return `tf:portfolio:${organizationId ?? ''}:${userId ?? ''}`;
}
export function readPortfolioState(key: string): PortfolioState {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (!value || typeof value !== 'object') return { ...EMPTY_PORTFOLIO };
    return {
      query: typeof value.query === 'string' ? value.query : '',
      status: parsePortfolioStatus(value.status) ?? 'all',
      ownOnly: value.ownOnly === true,
      scrollTop: Number.isFinite(value.scrollTop) && value.scrollTop >= 0 ? value.scrollTop : 0,
    };
  } catch { return { ...EMPTY_PORTFOLIO }; }
}
export function writePortfolioState(key: string, state: PortfolioState): void {
  try { sessionStorage.setItem(key, JSON.stringify(state)); } catch { /* Navigation works without browser storage. */ }
}
