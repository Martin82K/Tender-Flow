import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), eq: vi.fn(), is: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('@/services/supabase', () => ({ supabase: { from: mock.from } }));
vi.mock('@/services/functionsClient', () => ({ invokeAuthedFunction: vi.fn() }));
import { contractService } from '@/services/contractService';
beforeEach(() => {
  vi.resetAllMocks();
  mock.from.mockReturnValue(mock);
  mock.select.mockReturnValue(mock);
  mock.eq.mockReturnValue(mock);
  mock.is.mockReturnValue(mock);
  mock.update.mockReturnValue(mock);
});
describe('linkContractToBid', () => {
  it('refuses a bid outside the selected project before any write', async () => {
    mock.maybeSingle.mockResolvedValueOnce({ data: { demand_category_id: 'cat' }, error: null });
    mock.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(contractService.linkContractToBid('p1', 'c1', 'b1')).rejects.toThrow();
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('scopes the update to the project and refuses overwriting an existing link', async () => {
    mock.maybeSingle.mockResolvedValueOnce({ data: { demand_category_id: 'cat' }, error: null });
    mock.maybeSingle.mockResolvedValueOnce({ data: { id: 'cat' }, error: null });
    mock.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(contractService.linkContractToBid('p1', 'c1', 'b1')).rejects.toThrow();
    expect(mock.update).toHaveBeenCalledWith({ source_bid_id: 'b1' });
    expect(mock.eq).toHaveBeenCalledWith('project_id', 'p1');
    expect(mock.is).toHaveBeenCalledWith('source_bid_id', null);
  });
  it('accepts only an acknowledged write', async () => {
    mock.maybeSingle.mockResolvedValueOnce({ data: { demand_category_id: 'cat' }, error: null });
    mock.maybeSingle.mockResolvedValueOnce({ data: { id: 'cat' }, error: null });
    mock.maybeSingle.mockResolvedValueOnce({ data: { id: 'c1' }, error: null });
    await expect(contractService.linkContractToBid('p1', 'c1', 'b1')).resolves.toBeUndefined();
  });
});
