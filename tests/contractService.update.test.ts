import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
}));

vi.mock('@/services/supabase', () => ({
  supabase: {
    from: mocks.from,
    auth: { getUser: vi.fn() },
    storage: { from: vi.fn() },
    rpc: vi.fn(),
  },
}));

vi.mock('@/services/functionsClient', () => ({ invokeAuthedFunction: vi.fn() }));

import { contractService } from '@/services/contractService';

describe('contractService updateContract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.select.mockResolvedValue({ data: [{ id: 'contract-1' }], error: null });
    mocks.eq.mockReturnValue({ select: mocks.select });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.delete.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ update: mocks.update, delete: mocks.delete });
  });

  it('uloží změnu měny a umožní vymazat volitelné hodnoty', async () => {
    await contractService.updateContract('contract-1', {
      currency: 'EUR',
      contractNumber: undefined,
      vendorIco: undefined,
      signedAt: undefined,
      retentionShortPercent: undefined,
      warrantyMonths: undefined,
      paymentTerms: undefined,
    });

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'EUR',
        contract_number: null,
        vendor_ico: null,
        signed_at: null,
        retention_short_percent: null,
        warranty_months: null,
        payment_terms: null,
      }),
    );
  });

  it('ohlásí nepovolenou nebo neexistující aktualizaci místo falešného úspěchu', async () => {
    mocks.select.mockResolvedValue({ data: [], error: null });

    await expect(
      contractService.updateContract('missing-contract', { title: 'Změna' }),
    ).rejects.toThrow('nemáte oprávnění');
  });

  it('ohlásí nepovolené nebo neexistující smazání místo falešného úspěchu', async () => {
    mocks.select.mockResolvedValue({ data: [], error: null });

    await expect(contractService.deleteContract('missing-contract')).rejects.toThrow(
      'nemáte oprávnění',
    );
  });
});
