import { describe, expect, it } from 'vitest';
import { buildSearchIndex, searchAll } from '@shared/ui/GlobalSearch/searchEngine';
import type { SearchInputSources } from '@shared/ui/GlobalSearch/types';

const sources: SearchInputSources = {
  projects: [{ id: 'p1', name: 'Stavba', status: 'tender', location: 'Praha' }],
  contacts: [], projectDetails: {}, tasksEnabled: true, contractsEnabled: true,
  tasks: [{ id: 't1', title: 'Připravit výkres', note: 'Školka' }],
  contracts: [{ id: 'c1', projectId: 'p1', title: 'Smlouva na okna', contractNumber: 'SOD-42', vendorName: 'Žlutá firma' },
    { id: 'hidden', projectId: 'other', title: 'Tajná smlouva' }],
};

describe('extended global search', () => {
  it('finds task notes and contract numbers without diacritics and opens the exact entity', () => {
    const index = buildSearchIndex(sources);
    expect(searchAll('skolka', index)[0]?.items[0]?.navigateTo).toEqual({ view: 'todo', taskId: 't1' });
    expect(searchAll('SOD-42', index)[0]?.items[0]?.navigateTo).toEqual({ view: 'project', projectId: 'p1', tab: 'contracts', contractId: 'c1' });
    expect(searchAll('zluta', index)[0]?.items[0]?.title).toBe('Smlouva na okna');
  });
  it('fails closed for disabled modules and excludes contracts outside visible projects', () => {
    expect(searchAll('tajna', buildSearchIndex(sources))).toEqual([]);
    expect(searchAll('skolka', buildSearchIndex({ ...sources, tasksEnabled: false }))).toEqual([]);
    expect(searchAll('SOD', buildSearchIndex({ ...sources, contractsEnabled: false }))).toEqual([]);
    expect(searchAll('skolka', buildSearchIndex({ ...sources, tasksEnabled: undefined }))).toEqual([]);
  });
  it('reports every match and allows expanding past the first five results', () => {
    const index = buildSearchIndex({ ...sources, tasks: Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, title: `Výkres ${i}` })) });
    expect(searchAll('vykres', index)[0]?.items).toHaveLength(5);
    expect(searchAll('vykres', index)[0]?.totalCount).toBe(12);
    expect(searchAll('vykres', index, 15)[0]?.items).toHaveLength(12);
  });
});
