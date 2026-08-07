import { describe, expect, it } from 'vitest';
import { buildAppUrl, parseAppRoute } from '@/shared/routing/routeUtils';

describe('project contract deep-link', () => {
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
    });
  });
});
