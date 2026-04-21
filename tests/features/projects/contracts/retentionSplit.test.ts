import { describe, expect, it } from 'vitest';
import {
  computeRetention,
  sumProjectRetention,
} from '@features/projects/contracts/utils/retention';
import type { ContractWithDetails } from '@/types';

const makeContract = (overrides: Partial<ContractWithDetails> = {}): ContractWithDetails =>
  ({
    id: overrides.id ?? 'c1',
    projectId: 'p1',
    vendorName: 'Acme',
    title: 'SOD',
    status: 'active',
    currency: 'CZK',
    basePrice: 1_000_000,
    source: 'manual',
    amendments: [],
    drawdowns: [],
    invoices: [],
    currentTotal: overrides.currentTotal ?? 1_000_000,
    approvedSum: 0,
    remaining: overrides.currentTotal ?? 1_000_000,
    invoicedSum: 0,
    paidSum: 0,
    overdueSum: 0,
    ...overrides,
  } as ContractWithDetails);

describe('computeRetention', () => {
  it('dopočítá částky z procent, pokud nejsou uloženy', () => {
    const c = makeContract({
      currentTotal: 1_000_000,
      retentionShortPercent: 7,
      retentionLongPercent: 3,
    });
    const result = computeRetention(c);
    expect(result.shortPercent).toBe(7);
    expect(result.shortAmount).toBe(70_000);
    expect(result.longPercent).toBe(3);
    expect(result.longAmount).toBe(30_000);
    expect(result.totalPercent).toBe(10);
    expect(result.totalAmount).toBe(100_000);
  });

  it('respektuje explicitní částky, pokud jsou uloženy', () => {
    const c = makeContract({
      currentTotal: 1_000_000,
      retentionShortPercent: 7,
      retentionShortAmount: 55_555,
      retentionLongPercent: 3,
    });
    const result = computeRetention(c);
    expect(result.shortAmount).toBe(55_555);
    expect(result.longAmount).toBe(30_000);
  });

  it('nulové pozastávky vrátí 0 % a 0 Kč', () => {
    const c = makeContract({ currentTotal: 2_000_000 });
    const result = computeRetention(c);
    expect(result.totalPercent).toBe(0);
    expect(result.totalAmount).toBe(0);
  });
});

describe('sumProjectRetention', () => {
  it('nezahrne smlouvy s released pozastávkou', () => {
    const contracts = [
      makeContract({
        id: 'c1',
        currentTotal: 1_000_000,
        retentionShortPercent: 5,
        retentionLongPercent: 5,
        retentionShortStatus: 'held',
        retentionLongStatus: 'held',
      }),
      makeContract({
        id: 'c2',
        currentTotal: 500_000,
        retentionShortPercent: 10,
        retentionLongPercent: 0,
        retentionShortStatus: 'released',
      }),
    ];
    const { shortTotal, longTotal } = sumProjectRetention(contracts);
    expect(shortTotal).toBe(50_000); // c1 short only — c2 released
    expect(longTotal).toBe(50_000); // c1 long only
  });
});
