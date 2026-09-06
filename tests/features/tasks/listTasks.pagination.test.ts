import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), range: vi.fn(), eq: vi.fn(), order: vi.fn(), is: vi.fn(), not: vi.fn() }));
vi.mock('@infra/db/dbAdapter', () => ({ dbAdapter: { from: mocks.from } }));
import { listTasks } from '@features/tasks/api/tasksApi';
beforeEach(() => {
  vi.clearAllMocks();
  const query = { select: vi.fn().mockReturnThis(), eq: mocks.eq, order: mocks.order, is: mocks.is, not: mocks.not, range: mocks.range };
  for (const method of [mocks.eq, mocks.order, mocks.is, mocks.not]) method.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  mocks.range.mockImplementation(async (start: number, end: number) => ({ data: Array.from({ length: Math.max(0, Math.min(end + 1, 1001) - start) }, (_, i) => ({ id: `t${start + i}`, title: 'Úkol', created_by: 'u1' })), error: null }));
});
it('loads tasks beyond the server row cap with stable ordering and the same user and filters on every page', async () => {
  const tasks = await listTasks('u1', { includeArchived: true, completed: false, projectId: 'p1' });
  expect(tasks).toHaveLength(1001);
  expect(tasks[1000].id).toBe('t1000');
  expect(mocks.range.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  expect(mocks.eq.mock.calls.filter(([key]) => key === 'created_by')).toEqual(Array.from({ length: 3 }, () => ['created_by', 'u1']));
  expect(mocks.eq).toHaveBeenCalledWith('completed', false);
  expect(mocks.order).toHaveBeenCalledWith('id', { ascending: true });
});
it('rejects a failed later page rather than presenting an incomplete task list', async () => {
  mocks.range.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, i) => ({ id: `t${i}`, created_by: 'u1' })), error: null })
    .mockResolvedValueOnce({ data: null, error: new Error('failed page') });
  await expect(listTasks('u1')).rejects.toThrow('failed page');
});

it('does not return unexpected rows belonging to another owner', async () => {
  mocks.range.mockResolvedValue({ data: [{ id: 'mine', title: 'Mine', created_by: 'u1' }, { id: 'foreign', title: 'Foreign', created_by: 'u2' }], error: null });
  expect((await listTasks('u1')).map(task => task.id)).toEqual(['mine']);
});
