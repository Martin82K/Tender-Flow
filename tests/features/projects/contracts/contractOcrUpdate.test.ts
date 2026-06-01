import { describe, expect, it } from 'vitest';
import { buildContractUpdateFromOcr } from '@features/projects/contracts/utils/contractOcrUpdate';
import type { ContractExtractionResult } from '@/types';

const buildResult = (fields: Record<string, unknown>): ContractExtractionResult =>
  ({
    fields: fields as ContractExtractionResult['fields'],
    confidence: {},
  });

describe('buildContractUpdateFromOcr', () => {
  it('namapuje platná OCR pole do update payloadu smlouvy', () => {
    const result = buildContractUpdateFromOcr(
      buildResult({
        title: ' Konstrukce terasy ',
        contractNumber: '31/24026/2025',
        vendorName: 'Strojservis Homolka s.r.o',
        vendorIco: '263 933 95',
        signedAt: '2026-03-25',
        effectiveFrom: '2026-03-01',
        completionDate: '2026-07-31',
        basePrice: 1_372_066,
        currency: 'czk',
        retentionShortPercent: 8,
        retentionLongPercent: 2,
        siteSetupPercent: 1.8,
        warrantyMonths: 66,
        paymentTerms: '30 dní od doručení faktury',
        scopeSummary: 'Dodávka a montáž konstrukce terasy.',
      }),
    );

    expect(result.updates).toEqual({
      title: 'Konstrukce terasy',
      contractNumber: '31/24026/2025',
      vendorName: 'Strojservis Homolka s.r.o',
      vendorIco: '26393395',
      signedAt: '2026-03-25',
      effectiveFrom: '2026-03-01',
      completionDate: '2026-07-31',
      basePrice: 1_372_066,
      currency: 'CZK',
      retentionShortPercent: 8,
      retentionLongPercent: 2,
      siteSetupPercent: 1.8,
      warrantyMonths: 66,
      paymentTerms: '30 dní od doručení faktury',
      scopeSummary: 'Dodávka a montáž konstrukce terasy.',
    });
    expect(result.appliedFields).toEqual(Object.keys(result.updates));
  });

  it('použije effectiveTo jako fallback pro termín dokončení díla', () => {
    const result = buildContractUpdateFromOcr(
      buildResult({
        effectiveTo: '2026-08-15',
      }),
    );

    expect(result.updates).toMatchObject({
      effectiveTo: '2026-08-15',
      completionDate: '2026-08-15',
    });
  });

  it('odmítne nevalidní čísla, datumy, měnu a IČ', () => {
    const result = buildContractUpdateFromOcr(
      buildResult({
        vendorIco: '123',
        signedAt: '2026-02-31',
        basePrice: -1,
        currency: 'BTC',
        retentionShortPercent: 120,
        retentionLongPercent: -2,
        siteSetupPercent: Number.NaN,
        warrantyMonths: -1,
      }),
    );

    expect(result.updates).toEqual({});
    expect(result.appliedFields).toEqual([]);
  });

  it('ignoruje pole mimo whitelist z AI výstupu', () => {
    const result = buildContractUpdateFromOcr(
      buildResult({
        title: 'SOD',
        createdBy: 'attacker',
        vendorRatingBy: 'attacker',
        documentUrl: 'javascript:alert(1)',
        extractionJson: { injected: true },
      }),
    );

    expect(result.updates).toEqual({ title: 'SOD' });
    expect(result.appliedFields).toEqual(['title']);
  });
});
