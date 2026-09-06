import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/services/supabase', () => ({ supabase: { from: mocks.from } }));
import { tenderPlanRepository } from '@/infra/projects/tenderPlanRepository';
describe('tender plan recovery repository', () => {
  beforeEach(() => vi.resetAllMocks());
  it('reads all pages with deterministic ordering and project scope', async () => {
    const page = Array.from({ length: 500 }, (_, i) => ({ id: `tp${i}`, name: 'item', category_id: null }));
    const range = vi.fn().mockResolvedValueOnce({ data: page, error: null }).mockResolvedValueOnce({ data: [{ id: 'last', name: 'last', category_id: 'c1' }], error: null });
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query); mocks.from.mockReturnValue(query);
    const rows = await tenderPlanRepository.listByProject('p1');
    expect(rows).toHaveLength(501); expect(rows.at(-1)?.categoryId).toBe('c1');
    expect(query.eq).toHaveBeenCalledWith('project_id', 'p1'); expect(query.order).toHaveBeenCalledWith('id', { ascending: true });
    expect(range.mock.calls).toEqual([[0, 499], [500, 999]]);
  });
  it('rejects a zero-row link after a concurrent modification or revoked access', async () => {
    const query = { update: vi.fn(), eq: vi.fn(), is: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    for (const method of ['update', 'eq', 'is', 'select'] as const) query[method].mockReturnValue(query);
    mocks.from.mockReturnValue(query);
    await expect(tenderPlanRepository.linkUnassignedToCategory('p1', 'tp1', 'c1')).rejects.toThrow('Položka plánu se změnila');
    expect(query.eq.mock.calls).toEqual([['project_id', 'p1'], ['id', 'tp1']]);
    expect(query.is).toHaveBeenCalledWith('category_id', null);
  });
});
