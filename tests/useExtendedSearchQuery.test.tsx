import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Project } from '@/types';
const mocks = vi.hoisted(() => ({ from: vi.fn(), page: vi.fn(), calls: [] as { table: string; filters: [string, unknown][]; start: number; end: number }[] }));
vi.mock('@infra/db/dbAdapter', () => ({ dbAdapter: { from: mocks.from } }));
import { useExtendedSearchQuery } from '@features/search';
const projects: Project[] = [{ id: 'p1', name: 'Stavba', status: 'tender', location: 'Praha' }];
const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const hook = renderHook((props) => useExtendedSearchQuery(props), {
    initialProps: { userId: 'u1', isDemo: false, projects, tasksEnabled: true, contractsEnabled: true },
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
  return { ...hook, client };
};
beforeEach(() => {
  vi.clearAllMocks(); mocks.calls = [];
  mocks.page.mockImplementation(async (table: string, start: number, end: number) => ({ data: table === 'projects' ? [{ id: 'p1' }] : Array.from({ length: Math.max(0, Math.min(end + 1, 1001) - start) }, (_, i) => table === 'tasks'
    ? { id: `t${start + i}`, title: 'Výkres', created_by: 'u1', note: 'Detail' }
    : { id: `c${start + i}`, title: 'Smlouva', project_id: 'p1', contract_number: 'SOD', vendor_name: 'Dodavatel' }), error: null }));
  mocks.from.mockImplementation((table: string) => {
    const filters: [string, unknown][] = [];
    const builder = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
      in: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
      range: (start: number, end: number) => { mocks.calls.push({ table, filters, start, end }); return mocks.page(table, start, end); },
    };
    return builder;
  });
});
it('loads only on demand, paginates both indexes and validates project access before querying contracts', async () => {
  const { result } = setup();
  expect(mocks.from).not.toHaveBeenCalled();
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.contracts).toHaveLength(1001));
  expect(result.current.tasks).toHaveLength(1001);
  expect(mocks.calls.filter(call => call.table === 'tasks').map(call => call.filters)).toEqual(Array.from({ length: 3 }, () => [['created_by', 'u1']]));
  expect(mocks.calls.findIndex(call => call.table === 'projects')).toBeLessThan(mocks.calls.findIndex(call => call.table === 'contracts'));
  expect(mocks.calls.filter(call => call.table === 'contracts').every(call => JSON.stringify(call.filters) === JSON.stringify([['project_id', ['p1']]]))).toBe(true);
});
it('filters unexpected rows and fails closed when project validation returns no access', async () => {
  mocks.page.mockImplementation(async (table: string) => ({ data: table === 'tasks' ? [{ id: 'foreign', created_by: 'u2', title: 'Secret' }] : table === 'projects' ? [] : [{ id: 'foreign', project_id: 'other' }], error: null }));
  const { result } = setup();
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.isSearchLoading).toBe(false));
  expect(result.current.tasks).toEqual([]); expect(result.current.contracts).toEqual([]);
  expect(mocks.from).not.toHaveBeenCalledWith('contracts');
});
it('hides previous user data, revoked modules and stale project sets immediately', async () => {
  const { result, rerender } = setup();
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.contracts).toHaveLength(1001));
  rerender({ userId: 'u1', isDemo: false, projects, tasksEnabled: false, contractsEnabled: false });
  expect(result.current.tasks).toEqual([]); expect(result.current.contracts).toEqual([]);
  mocks.page.mockReturnValue(new Promise(() => {}));
  rerender({ userId: 'u2', isDemo: false, projects: [], tasksEnabled: true, contractsEnabled: true });
  expect(result.current.tasks).toEqual([]); expect(result.current.contracts).toEqual([]);
  const calls = mocks.from.mock.calls.length;
  rerender({ userId: '', isDemo: false, projects: [], tasksEnabled: true, contractsEnabled: true });
  act(() => result.current.requestSearch());
  expect(mocks.from).toHaveBeenCalledTimes(calls);
});
it('does not query disabled modules or demo and retries failed pages without duplicate results', async () => {
  const { result, rerender } = setup();
  rerender({ userId: 'u1', isDemo: true, projects, tasksEnabled: true, contractsEnabled: true });
  act(() => result.current.requestSearch());
  expect(mocks.from).not.toHaveBeenCalled();
  rerender({ userId: 'u1', isDemo: false, projects, tasksEnabled: true, contractsEnabled: false });
  mocks.page.mockResolvedValue({ data: null, error: new Error('page failed') });
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.tasks).toEqual([]);
  mocks.page.mockResolvedValue({ data: [{ id: 't1', title: 'Úkol', created_by: 'u1' }], error: null });
  await act(async () => { await result.current.retrySearch(); });
  await waitFor(() => expect(result.current.tasks).toHaveLength(1));
  expect(mocks.from).not.toHaveBeenCalledWith('contracts');
});
it('shares the task and contract mutation invalidation namespaces', async () => {
  const { result, client } = setup();
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.contracts).toHaveLength(1001));
  const before = mocks.calls.length;
  await act(async () => { await client.invalidateQueries({ queryKey: ['tasks'] }); await client.invalidateQueries({ queryKey: ['contracts'] }); });
  expect(mocks.calls.length).toBeGreaterThan(before);
});
it('drops contracts after project access changes and filters rows outside the validated set', async () => {
  mocks.page.mockImplementation(async (table: string) => ({ data: table === 'projects' ? [{ id: 'p1' }, { id: 'unexpected' }]
    : table === 'contracts' ? [{ id: 'c1', project_id: 'p1', title: 'Visible' }, { id: 'c2', project_id: 'unexpected', title: 'Hidden' }] : [], error: null }));
  const { result, rerender } = setup();
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.contracts).toHaveLength(1));
  expect(result.current.contracts[0].id).toBe('c1');
  expect(mocks.calls.find(call => call.table === 'contracts')?.filters).toEqual([['project_id', ['p1']]]);
  rerender({ userId: 'u1', isDemo: false, projects: [], tasksEnabled: true, contractsEnabled: true });
  expect(result.current.contracts).toEqual([]);
});
it('batches a large project portfolio instead of truncating the searchable set', async () => {
  mocks.page.mockImplementation(async (table: string) => {
    const call = mocks.calls[mocks.calls.length - 1];
    const ids = call.filters[0]?.[1] as string[];
    return { data: table === 'projects' ? ids.map(id => ({ id })) : table === 'contracts' ? ids.map(id => ({ id: `c-${id}`, project_id: id, title: 'Contract' })) : [], error: null };
  });
  const { result, rerender } = setup();
  rerender({ userId: 'u1', isDemo: false, projects: Array.from({ length: 205 }, (_, i) => ({ ...projects[0], id: `p${i}` })), tasksEnabled: false, contractsEnabled: true });
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.contracts).toHaveLength(205));
  expect(mocks.calls.filter(call => call.table === 'projects').map(call => (call.filters[0][1] as string[]).length)).toEqual([100, 100, 5]);
});
it('does not continue fetching pages for a user after switching identities', async () => {
  let resolvePage: ((value: { data: unknown[]; error: null }) => void) | undefined;
  mocks.page.mockImplementation(() => new Promise(resolve => { resolvePage = resolve; }));
  const { result, rerender } = setup();
  rerender({ userId: 'u1', isDemo: false, projects: [], tasksEnabled: true, contractsEnabled: false });
  act(() => result.current.requestSearch());
  await waitFor(() => expect(resolvePage).toBeDefined());
  rerender({ userId: 'u2', isDemo: false, projects: [], tasksEnabled: true, contractsEnabled: false });
  await act(async () => { resolvePage?.({ data: Array.from({ length: 500 }, (_, i) => ({ id: `t${i}`, title: 'Private', created_by: 'u1' })), error: null }); });
  expect(result.current.tasks).toEqual([]);
  expect(mocks.calls.filter(call => call.table === 'tasks')).toHaveLength(1);
});

it('refreshes metadata when search reopens after a locally managed contract edit', async () => {
  const { result } = setup();
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.contracts).toHaveLength(1001));
  mocks.page.mockImplementation(async (table: string) => ({ data: table === 'projects' ? [{ id: 'p1' }] : table === 'contracts' ? [{ id: 'new', project_id: 'p1', title: 'Edited' }] : [], error: null }));
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.contracts).toHaveLength(1));
  expect(result.current.contracts[0].title).toBe('Edited');
});
it.each(['failed', 'revoked'])('hides previously verified results while access is revalidated and remains empty after %s access', async (outcome) => {
  const { result } = setup();
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.contracts).toHaveLength(1001));
  await waitFor(() => expect(result.current.tasks).toHaveLength(1001));
  let resolvePage: ((value: { data: unknown[]; error: Error | null }) => void) | undefined;
  const pending = new Promise(resolve => { resolvePage = resolve; });
  mocks.page.mockReturnValue(pending);
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.isSearchLoading).toBe(true));
  expect(result.current.contracts).toEqual([]);
  expect(result.current.tasks).toEqual([]);
  await act(async () => { resolvePage?.({ data: [], error: outcome === 'failed' ? new Error('revalidation failed') : null }); });
  await waitFor(() => expect(result.current.isSearchLoading).toBe(false));
  expect(result.current.contracts).toEqual([]);
  expect(result.current.tasks).toEqual([]);
  expect(result.current.isError).toBe(outcome === 'failed');
});

it('keeps previous indexes hidden when a new access check is paused offline', async () => {
  const { result } = setup();
  act(() => result.current.requestSearch());
  await waitFor(() => expect(result.current.contracts).toHaveLength(1001));
  try {
    onlineManager.setOnline(false);
    act(() => result.current.requestSearch());
    await waitFor(() => expect(result.current.contracts).toEqual([]));
    expect(result.current.tasks).toEqual([]);
    expect(result.current.isSearchLoading).toBe(true);
    mocks.page.mockResolvedValue({ data: [], error: null });
  } finally {
    await act(async () => { onlineManager.setOnline(true); });
  }
  await waitFor(() => expect(result.current.isSearchLoading).toBe(false));
});
