import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DemandCategory } from '@/types';
const repo = vi.hoisted(() => ({ listByProject: vi.fn(), create: vi.fn(), linkUnassignedToCategory: vi.fn() }));
vi.mock('@/infra/projects/tenderPlanRepository', () => ({ tenderPlanRepository: repo }));
import { synchronizeCategoryPlan } from '@features/projects/api/categoryPlanRecoveryApi';
const category = { id: 'c1', title: 'Okna' } as DemandCategory;
describe('category plan synchronization', () => {
  beforeEach(() => { vi.resetAllMocks(); repo.listByProject.mockResolvedValue([]); });
  it('reuses a stable insert id after a lost response', async () => {
    repo.create.mockRejectedValueOnce(new Error('response lost'));
    await expect(synchronizeCategoryPlan('p1', category, () => true)).rejects.toThrow();
    await synchronizeCategoryPlan('p1', category, () => true);
    expect(repo.create.mock.calls[0][0].id).toBe(repo.create.mock.calls[1][0].id);
  });
  it('recognizes a previously committed category link even after its name changed', async () => {
    repo.listByProject.mockResolvedValue([{ id: 'tp1', name: 'Renamed', categoryId: 'c1' }]);
    await synchronizeCategoryPlan('p1', category, () => true);
    expect(repo.create).not.toHaveBeenCalled(); expect(repo.linkUnassignedToCategory).not.toHaveBeenCalled();
  });
  it('links only an unassigned matching plan with project scoping', async () => {
    repo.listByProject.mockResolvedValue([{ id: 'other', name: 'Okna', categoryId: 'other' }, { id: 'tp1', name: ' OKNA ', categoryId: null }]);
    await synchronizeCategoryPlan('p1', category, () => true);
    expect(repo.linkUnassignedToCategory).toHaveBeenCalledWith('p1', 'tp1', 'c1');
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('does not overwrite a different category with the same title', async () => {
    repo.listByProject.mockResolvedValue([{ id: 'other', name: 'Okna', categoryId: 'other' }]);
    await synchronizeCategoryPlan('p1', category, () => true);
    expect(repo.linkUnassignedToCategory).not.toHaveBeenCalled(); expect(repo.create).toHaveBeenCalledOnce();
  });
  it('stops before a write if the active identity changed during the read', async () => {
    await synchronizeCategoryPlan('p1', category, () => false);
    expect(repo.create).not.toHaveBeenCalled(); expect(repo.linkUnassignedToCategory).not.toHaveBeenCalled();
  });
});

it('fits the tender plan VARCHAR(36) primary key for UUID categories', async () => {
  repo.listByProject.mockResolvedValue([]); repo.create.mockResolvedValue(undefined);
  await synchronizeCategoryPlan('p1', { ...category, id: '123e4567-e89b-12d3-a456-426614174000' }, () => true);
  expect(repo.create.mock.lastCall?.[0].id.length).toBeLessThanOrEqual(36);
});
