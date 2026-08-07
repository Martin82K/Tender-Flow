import { describe, expect, it } from 'vitest';
import { resolveBidContractLink } from '@/features/projects/contracts/model/contractBidLink';
import type { Bid, ContractWithDetails } from '@/types';

const bid = (overrides: Partial<Bid> = {}): Bid => ({
  id: 'bid-1',
  subcontractorId: 'vendor-1',
  companyName: 'Dodavatel 1',
  contactPerson: 'Jan Novák',
  email: 'jan@example.com',
  phone: '',
  price: '100 000 Kč',
  status: 'sod',
  contracted: true,
  ...overrides,
});

const contract = (overrides: Partial<ContractWithDetails> = {}): ContractWithDetails => ({
  id: 'contract-1',
  projectId: 'project-1',
  vendorId: 'vendor-1',
  vendorName: 'Dodavatel 1',
  title: 'SOD Dodavatel 1',
  status: 'active',
  currency: 'CZK',
  basePrice: 100_000,
  source: 'from_tender_winner',
  sourceBidId: 'bid-1',
  amendments: [],
  drawdowns: [],
  invoices: [],
  currentTotal: 100_000,
  approvedSum: 0,
  remaining: 100_000,
  invoicedSum: 0,
  paidSum: 0,
  overdueSum: 0,
  ...overrides,
});

describe('resolveBidContractLink', () => {
  it('upřednostní jednoznačnou vazbu přes sourceBidId', () => {
    const result = resolveBidContractLink(bid(), [
      contract({ id: 'legacy', sourceBidId: undefined }),
      contract({ id: 'direct' }),
    ]);

    expect(result).toEqual({ contract: expect.objectContaining({ id: 'direct' }), match: 'sourceBidId', ambiguous: false });
  });

  it('použije vendorId jen u jediné historické shody', () => {
    const result = resolveBidContractLink(bid(), [contract({ sourceBidId: undefined })]);

    expect(result.match).toBe('vendorId');
    expect(result.contract?.id).toBe('contract-1');
  });

  it('neotevře náhodnou smlouvu při více historických shodách', () => {
    const result = resolveBidContractLink(bid(), [
      contract({ id: 'contract-1', sourceBidId: undefined }),
      contract({ id: 'contract-2', sourceBidId: undefined }),
    ]);

    expect(result).toEqual({ contract: null, match: null, ambiguous: true });
  });
});
