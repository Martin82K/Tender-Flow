import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), insert: vi.fn(), rpc: vi.fn(), eq: vi.fn(), is: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('@/services/supabase', () => ({ supabase: { from: mock.from, rpc: mock.rpc } }));
vi.mock('@/services/functionsClient', () => ({ invokeAuthedFunction: vi.fn() }));
import { contractService } from '@/services/contractService';
beforeEach(() => {
  vi.resetAllMocks();
  mock.from.mockReturnValue(mock);
  mock.select.mockReturnValue(mock);
  mock.eq.mockReturnValue(mock);
  mock.is.mockReturnValue(mock);
  mock.update.mockReturnValue(mock);
  mock.insert.mockReturnValue(mock);
});
describe('linkContractToBid', () => {
  it('refuses a bid outside the selected project before any write', async () => {
    mock.maybeSingle.mockResolvedValueOnce({ data: { demand_category_id: 'cat' }, error: null });
    mock.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(contractService.linkContractToBid('p1', 'c1', 'b1')).rejects.toThrow();
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('requires an acknowledged insert scoped to the project', async () => {
    mock.maybeSingle.mockResolvedValueOnce({ data: { demand_category_id: 'cat' }, error: null });
    mock.maybeSingle.mockResolvedValueOnce({ data: { id: 'cat' }, error: null });
    mock.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(contractService.linkContractToBid('p1', 'c1', 'b1')).rejects.toThrow();
    expect(mock.insert).toHaveBeenCalledWith({ contract_id: 'c1', project_id: 'p1', bid_id: 'b1', category_id: 'cat' });
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('reports a storage error without falsely claiming an existing link', async () => {
    mock.maybeSingle.mockResolvedValueOnce({ data: { demand_category_id: 'cat' }, error: null });
    mock.maybeSingle.mockResolvedValueOnce({ data: { id: 'cat' }, error: null });
    mock.maybeSingle.mockResolvedValueOnce({ data: null, error: { code: '23505' } });
    await expect(contractService.linkContractToBid('p1', 'c1', 'restored-' + 'x'.repeat(45))).rejects.toThrow('Toto VŘ už má propojenou smlouvu');
    expect(mock.update).not.toHaveBeenCalled();
  });

  it('accepts only an acknowledged write', async () => {
    mock.maybeSingle.mockResolvedValueOnce({ data: { demand_category_id: 'cat' }, error: null });
    mock.maybeSingle.mockResolvedValueOnce({ data: { id: 'cat' }, error: null });
    mock.maybeSingle.mockResolvedValueOnce({ data: { id: 'c1' }, error: null });
    const restoredBidId = 'restored-' + 'x'.repeat(45);
    await expect(contractService.linkContractToBid('p1', 'c1', restoredBidId)).resolves.toBeUndefined();
    expect(mock.insert).toHaveBeenCalledWith({ contract_id: 'c1', project_id: 'p1', bid_id: restoredBidId, category_id: 'cat' });
  });
});

it('removes only the requested link through the atomic operation', async () => {
  mock.rpc.mockResolvedValue({ data: true, error: null });
  await contractService.unlinkContractFromBid('p1', 'c1', 'b2');
  expect(mock.rpc).toHaveBeenCalledWith('unlink_contract_bid', { p_project_id: 'p1', p_contract_id: 'c1', p_bid_id: 'b2' });
});
it('does not report an unacknowledged unlink as success', async () => {
  mock.rpc.mockResolvedValue({ data: false, error: null });
  await expect(contractService.unlinkContractFromBid('p1', 'c1', 'b2')).rejects.toThrow();
});
