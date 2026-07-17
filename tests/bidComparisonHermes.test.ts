/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { analyzeBidComparisonWithHermes, testBidComparisonHermesConnection } from '../desktop/main/services/bidComparisonHermes';

const tempDirs: string[] = [];

const createFixture = async (): Promise<{ root: string; reference: string; offer: string }> => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bid-hermes-'));
  tempDirs.push(root);
  const reference = path.join(root, 'zadani.pdf');
  const offer = path.join(root, 'nabidka.docx');
  await writeFile(reference, Buffer.from('%PDF-1.7'));
  await writeFile(offer, Buffer.from('PK\u0003\u0004'));
  return { root, reference, offer };
};

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const responsePayload = (requestId: string) => ({
  schemaVersion: 1,
  requestId,
  referenceItems: [{ referenceItemId: 'R-1', description: 'SDK příčka', quantity: 10, unit: 'm2', sourceText: 'SDK příčka 10 m2', uncertainty: null }],
  suppliers: [{ supplierId: 'offer_1', supplierName: 'Dodavatel A', round: '1', localScore: null }],
  matrix: [{ referenceItemId: 'R-1', offers: [{ supplierId: 'offer_1', offerItemDescription: 'Příčka SDK', quantity: 10, unitPrice: 500, totalPrice: 5000, currency: 'CZK', matchStatus: 'matched', uncertainty: null }] }],
  findings: [],
  summary: 'Nabídka je úplná.',
  risks: [{ severity: 'low', message: 'Ověřit termín.', relatedSupplierIds: ['offer_1'] }],
  recommendedChecks: ['Potvrdit termín realizace.'],
});

describe('bidComparisonHermes', () => {
  it('testuje spojení přes skutečný /analyze kontrakt, ne přes starý bid-analysis endpoint', async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('https://agent.kalmatech.cz/v1/tender-flow/analyze');
      const form = init.body as FormData;
      const requestId = String(form.get('requestId'));
      expect(form.get('instructionProfile')).toBe('tender-analysis');
      expect(form.getAll('offerFiles')).toHaveLength(1);
      return new Response(JSON.stringify({
        schemaVersion: 1,
        requestId,
        referenceItems: [{ referenceItemId: 'R-1', description: 'Test položka', quantity: 1, unit: null, sourceText: 'Test položka', uncertainty: null }],
        suppliers: [{ supplierId: 'connection_test', supplierName: 'Test spojení', round: '0', localScore: null }],
        matrix: [{ referenceItemId: 'R-1', offers: [{ supplierId: 'connection_test', offerItemDescription: 'Test položka', quantity: 1, unitPrice: 1, totalPrice: 1, currency: 'CZK', matchStatus: 'matched', uncertainty: null }] }],
        findings: [], summary: 'Spojení funguje.', risks: [], recommendedChecks: [],
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(testBidComparisonHermesConnection({ enabled: true, baseUrl: 'https://agent.kalmatech.cz', timeoutMs: 60_000 }, '0123456789abcdef')).resolves.toMatchObject({
      success: true,
      endpoint: 'https://agent.kalmatech.cz/v1/tender-flow/analyze',
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('odešle různorodé podklady jedním verzovaným požadavkem a vytvoří lokální normalizaci', async () => {
    const fixture = await createFixture();
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('https://agent.kalmatech.cz/v1/tender-flow/analyze');
      expect((init.headers as Record<string, string>).authorization).toBe('Bearer secret');
      const form = init.body as FormData;
      expect(form.get('schemaVersion')).toBe('1');
      expect(form.get('instructionProfile')).toBe('tender-analysis');
      expect(JSON.parse(String(form.get('offerMetadata')))).toEqual([{ supplierId: 'offer_1', supplierName: 'Dodavatel A', round: '1', localScore: null }]);
      expect(form.get('referenceFile')).toBeInstanceOf(Blob);
      expect(form.getAll('offerFiles')).toHaveLength(1);
      return new Response(JSON.stringify(responsePayload('req-1')), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await analyzeBidComparisonWithHermes({
      rootPath: fixture.root,
      reference: { path: fixture.reference, role: 'zadani' },
      offers: [{ path: fixture.offer, role: 'offer', supplierName: 'Dodavatel A', round: 1, variant: 1 }],
      baseUrl: 'https://agent.kalmatech.cz',
      secret: 'secret',
      requestId: 'req-1',
    });

    expect(result.referenceWorkbookPath).toContain('porovnani-normalized');
    expect(result.referenceNormalization?.result.items).toHaveLength(1);
    expect(result.offers[0].result.items[0]).toMatchObject({ kod: 'R-1', jcena: 500, celkem: 5000, reviewRequired: false });
    expect(result.recommendation).toMatchObject({ summary: 'Nabídka je úplná.', recommendedSupplier: null });
  });

  it('odmítne neúplnou matici a explicitní jinou měnu než CZK', async () => {
    const fixture = await createFixture();
    const incomplete = responsePayload('req-incomplete');
    incomplete.matrix[0].offers = [];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(incomplete), { status: 200 })));
    await expect(analyzeBidComparisonWithHermes({
      rootPath: fixture.root,
      offers: [{ path: fixture.offer, role: 'offer', supplierName: 'Dodavatel A', round: 1, variant: 1 }],
      baseUrl: 'https://agent.kalmatech.cz', secret: 'secret', requestId: 'req-incomplete',
    })).rejects.toThrow('úplnou matici');

    const foreignCurrency = responsePayload('req-eur');
    foreignCurrency.matrix[0].offers[0].currency = 'EUR';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(foreignCurrency), { status: 200 })));
    await expect(analyzeBidComparisonWithHermes({
      rootPath: fixture.root,
      offers: [{ path: fixture.offer, role: 'offer', supplierName: 'Dodavatel A', round: 1, variant: 1 }],
      baseUrl: 'https://agent.kalmatech.cz', secret: 'secret', requestId: 'req-eur',
    })).rejects.toThrow('měnu');
  });

  it('odmítne změnu lokálního skóre a agentní výběr vítěze', async () => {
    const fixture = await createFixture();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...responsePayload('req-2'), recommendedWinner: 'Dodavatel A' }), { status: 200 })));
    await expect(analyzeBidComparisonWithHermes({
      rootPath: fixture.root,
      offers: [{ path: fixture.offer, role: 'offer', supplierName: 'Dodavatel A', round: 1, variant: 1 }],
      baseUrl: 'https://agent.kalmatech.cz', secret: 'secret', requestId: 'req-2',
    })).rejects.toThrow('výběr vítěze');
  });

  it('neodešle soubor mimo kořen VŘ ani požadavek bez tokenu', async () => {
    const fixture = await createFixture();
    const outside = await mkdtemp(path.join(os.tmpdir(), 'bid-hermes-outside-'));
    tempDirs.push(outside);
    const outsideOffer = path.join(outside, 'nabidka.pdf');
    await writeFile(outsideOffer, Buffer.from('%PDF-1.7'));
    await expect(analyzeBidComparisonWithHermes({ rootPath: fixture.root, offers: [{ path: fixture.offer, role: 'offer', supplierName: 'A', round: 0, variant: 1 }], baseUrl: 'https://agent.kalmatech.cz', secret: '', requestId: 'req-3' })).rejects.toThrow('API token');
    await expect(analyzeBidComparisonWithHermes({ rootPath: fixture.root, offers: [{ path: outsideOffer, role: 'offer', supplierName: 'A', round: 0, variant: 1 }], baseUrl: 'https://agent.kalmatech.cz', secret: 'secret', requestId: 'req-4' })).rejects.toThrow('mimo složku VŘ');
  });
});
