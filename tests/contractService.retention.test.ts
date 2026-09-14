import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/services/supabase', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));
vi.mock('@/services/functionsClient', () => ({ invokeAuthedFunction: vi.fn() }));
import { contractService } from '@/services/contractService';
describe('contract retention confirmation', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ error: null }); });
  it('uses atomic confirmation without rewriting the planned date', async () => {
    await contractService.releaseRetention('c1', 'short', '2026-08-12');
    expect(mocks.rpc).toHaveBeenCalledWith('release_contract_retention', { contract_id_input: 'c1', kind_input: 'short', date_input: '2026-08-12' });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('propagates a permission or concurrent release failure', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'Pozastávka již byla uvolněna.' } });
    await expect(contractService.releaseRetention('c1', 'long', '2026-08-12')).rejects.toThrow('již byla uvolněna');
  });
});
