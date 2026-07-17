import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestBidComparisonAgentRecommendation } from '../desktop/main/services/bidComparisonAgent';
import { createDefaultBidComparisonConfig, evaluateBidComparison } from '../desktop/main/services/bidComparisonScoring';
import type { BidComparisonMatrixItem } from '../desktop/main/types';

describe('Hermes kontrakt porovnání nabídek', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('odesílá verzi 2, request ID a idempotency bez lokálních cest', async () => {
    const rows: BidComparisonMatrixItem[] = [{
      pc: '1', kod: 'A', popis: 'Položka', mj: 'ks', mnozstvi: 1, radek: 5,
      offers: { Alfa: { supplierName: 'Alfa', displayLabel: 'Alfa', round: 1, variant: 1, jcena: 100, celkem: 100, matched: true } },
    }];
    const config = createDefaultBidComparisonConfig();
    const evaluation = evaluateBidComparison(rows, config);
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify({
      version: 2,
      recommendation: { summary: 'Alfa je cenově nejvýhodnější.', recommendedSupplier: 'Alfa', nextSteps: [], risks: [] },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await requestBidComparisonAgentRecommendation({
      config: { enabled: true, baseUrl: 'https://agent.kalmatech.cz', timeoutMs: 60_000 },
      projectId: 'project-1', categoryId: 'category-1', tenderFolderName: 'Výběrové řízení',
      pocetPolozek: 1, suppliers: { Alfa: { sparovano: 1, nesparovano: [], round: 1, variant: 1 } },
      matrix: rows, requestId: '123e4567-e89b-12d3-a456-426614174000', evaluation, criteria: {},
    }, '0123456789abcdef');

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ version: 2, requestId: '123e4567-e89b-12d3-a456-426614174000' });
    expect(body.policy).toEqual({
      inputTrust: 'untrusted-business-data',
      numericAuthority: 'tender-flow-local',
      allowedTask: 'explain-and-flag-only',
    });
    expect(init?.headers).toMatchObject({
      'x-request-id': '123e4567-e89b-12d3-a456-426614174000',
      'idempotency-key': '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(JSON.stringify(body)).not.toContain('/Tender/');
  });

  it('odmítne doporučení neznámého dodavatele', async () => {
    const rows: BidComparisonMatrixItem[] = [{
      pc: '1', kod: 'A', popis: 'Položka', mj: 'ks', mnozstvi: 1, radek: 5,
      offers: { Alfa: { supplierName: 'Alfa', displayLabel: 'Alfa', round: 1, variant: 1, jcena: 100, celkem: 100, matched: true } },
    }];
    const config = createDefaultBidComparisonConfig();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ version: 2, recommendation: { summary: 'Výsledek', recommendedSupplier: 'Útočník', nextSteps: [], risks: [] } }), { status: 200 })));
    await expect(requestBidComparisonAgentRecommendation({
      config: { enabled: true, baseUrl: 'https://agent.kalmatech.cz' }, projectId: null, categoryId: null,
      tenderFolderName: 'VŘ', pocetPolozek: 1, suppliers: {}, matrix: rows, requestId: 'request-1',
      evaluation: evaluateBidComparison(rows, config), criteria: {},
    }, '0123456789abcdef')).rejects.toThrow('neznámého dodavatele');
  });
});
