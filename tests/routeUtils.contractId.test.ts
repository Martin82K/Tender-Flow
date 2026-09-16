import { describe, expect, it } from 'vitest';
import { buildAppUrl, parseAppRoute } from '@/shared/routing/routeUtils';

describe('project contract deep-link', () => {
  it('keeps project configuration distinct from the legacy team settings route', () => {
    for (const tab of ['project-settings', 'settings'] as const) {
      const url = new URL(buildAppUrl('project', { projectId: 'p1', tab }), 'https://example.com');
      expect(parseAppRoute(url.pathname, url.search)).toMatchObject({ projectId: 'p1', tab });
    }
  });
  it('round-trips the client contracts section separately from supplier contracts', () => {
    const url = buildAppUrl('project', { projectId: 'p1', tab: 'contracts-client' });
    const parsed = new URL(url, 'https://example.com');
    expect(parseAppRoute(parsed.pathname, parsed.search)).toMatchObject({ projectId: 'p1', tab: 'contracts-client' });
  });
  it('preserves the exact source card including reserved characters', () => {
    const url = buildAppUrl('project', { projectId: 'p1', tab: 'pipeline', categoryId: 'cat&1', bidId: 'bid/2' });
    const parsed = new URL(url, 'https://example.com');
    expect(parseAppRoute(parsed.pathname, parsed.search)).toMatchObject({ categoryId: 'cat&1', bidId: 'bid/2' });
  });
  it('sestaví a načte URL konkrétní smlouvy', () => {
    const url = buildAppUrl('project', {
      projectId: 'project/1',
      tab: 'contracts',
      contractId: 'contract-1',
    });

    expect(url).toBe('/app/project/project%2F1?tab=contracts&contractId=contract-1');
    expect(parseAppRoute('/app/project/project%2F1', '?tab=contracts&contractId=contract-1')).toEqual({
      isApp: true,
      view: 'project',
      projectId: 'project/1',
      tab: 'contracts',
      categoryId: undefined,
      contractId: 'contract-1',
      bidId: undefined,
    });
  });
});
