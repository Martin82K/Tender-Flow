import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), remove: vi.fn() }));
vi.mock('@infra/db/dbAdapter', () => ({ dbAdapter: { rpc: mocks.rpc, storage: { from: () => ({ remove: mocks.remove }) } } }));
import { deleteProjectWithBudget } from '@features/projects/budget/api/deleteProjectWithBudget';
beforeEach(() => { vi.resetAllMocks(); mocks.remove.mockResolvedValue({ error: null }); });
it('removes file bytes before finishing the durable project deletion', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: { id: 'job', completed: false, paths: ['org/source/source.xlsx'] }, error: null }).mockResolvedValueOnce({ error: null });
  await deleteProjectWithBudget('p');
  expect(mocks.remove).toHaveBeenCalledWith(['org/source/source.xlsx']);
  expect(mocks.rpc).toHaveBeenLastCalledWith('construction_budget_project_delete_finish', { project_input: 'p', job_input: 'job' });
  expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[1]);
});
it('leaves metadata and the job intact when Storage fails', async () => {
  mocks.rpc.mockResolvedValue({ data: { id: 'job', completed: false, paths: ['file'] }, error: null });
  mocks.remove.mockResolvedValue({ error: { message: 'offline' } });
  await expect(deleteProjectWithBudget('p')).rejects.toThrow('Opakujte mazání');
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it('does nothing when a previous retry already removed the project', async () => {
  mocks.rpc.mockResolvedValue({ data: { completed: true, paths: [] }, error: null });
  await deleteProjectWithBudget('p');
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
