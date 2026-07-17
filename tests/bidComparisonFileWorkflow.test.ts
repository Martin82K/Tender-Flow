import { mkdtemp, readFile, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  createDefaultBidComparisonConfig,
  evaluateBidComparison,
  validateBidComparisonConfig,
} from '../desktop/main/services/bidComparisonScoring';
import {
  atomicWriteWorkspaceFile,
  BID_COMPARISON_CONFIG_FILE,
  BID_COMPARISON_RESULT_FILE,
  loadBidComparisonConfig,
  loadBidComparisonResult,
  saveBidComparisonConfig,
} from '../desktop/main/services/bidComparisonWorkspace';
import type { BidComparisonMatrixItem } from '../desktop/main/types';

const tempFolder = () => mkdtemp(path.join(tmpdir(), 'bid-file-workflow-'));

const matrix: BidComparisonMatrixItem[] = [
  {
    pc: '1', kod: 'A', popis: 'Položka', mj: 'ks', mnozstvi: 1, radek: 5,
    offers: {
      Alfa: { supplierName: 'Alfa', displayLabel: 'Alfa', round: 1, variant: 1, jcena: 50, celkem: 50, matched: true },
      Beta: { supplierName: 'Beta', displayLabel: 'Beta', round: 1, variant: 1, jcena: 100, celkem: 100, matched: true },
      Gama: { supplierName: 'Gama', displayLabel: 'Gama', round: 1, variant: 1, jcena: 110, celkem: 110, matched: true },
    },
  },
];

describe('souborové porovnávání nabídek', () => {
  it('počítá transparentní pořadí a cenové anomálie bez databáze', () => {
    const evaluation = evaluateBidComparison(matrix, createDefaultBidComparisonConfig());
    expect(evaluation.scores[0]).toMatchObject({ supplierName: 'Alfa', rank: 1, totalPrice: 50 });
    expect(evaluation.anomalies).toEqual(expect.arrayContaining([
      expect.objectContaining({ supplierName: 'Alfa', direction: 'low' }),
    ]));
    expect(evaluation.warnings).toHaveLength(2);
    expect(Object.values(evaluation.effectiveWeights).reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 2);
  });

  it('odmítne váhy, jejichž součet není 100 procent', () => {
    const config = createDefaultBidComparisonConfig();
    config.weights.price = 44;
    expect(() => validateBidComparisonConfig(config)).toThrow('Součet vah');
  });

  it('odmítne konfiguraci bez všech vah a neplatné kalendářní datum', () => {
    const missingWeight = createDefaultBidComparisonConfig() as unknown as Record<string, unknown>;
    missingWeight.weights = { price: 100 };
    expect(() => validateBidComparisonConfig(missingWeight as never)).toThrow('všech pět');

    const invalidDate = createDefaultBidComparisonConfig();
    invalidDate.suppliers.Alfa = {
      realizationDate: '2026-99-99', warrantyMonths: 12, maturityDays: 30,
      scopeConfirmed: true, supplierRating: 4, note: '',
    };
    expect(() => validateBidComparisonConfig(invalidDate)).toThrow('Neplatný termín');
  });

  it('nezapočítá neúplný součet do cenového skóre', () => {
    const rows: BidComparisonMatrixItem[] = [
      {
        ...matrix[0],
        offers: {
          Alfa: { ...matrix[0].offers.Alfa, celkem: 50 },
          Beta: { ...matrix[0].offers.Beta, celkem: 100 },
        },
      },
      {
        pc: '2', kod: 'B', popis: 'Druhá položka', mj: 'ks', mnozstvi: 1, radek: 6,
        offers: {
          Alfa: { ...matrix[0].offers.Alfa, jcena: null, celkem: null, matched: false },
          Beta: { ...matrix[0].offers.Beta, jcena: 100, celkem: 100, matched: true },
        },
      },
    ];
    const evaluation = evaluateBidComparison(rows, createDefaultBidComparisonConfig());
    expect(evaluation.scores.find((score) => score.supplierName === 'Alfa')).toMatchObject({
      totalPrice: null,
      scores: { price: 0, completeness: 50 },
    });
    expect(evaluation.scores[0].supplierName).toBe('Beta');
  });

  it('ukládá a načítá konfiguraci atomicky ve složce VŘ', async () => {
    const folder = await tempFolder();
    const config = createDefaultBidComparisonConfig();
    config.suppliers.Alfa = {
      realizationDate: '2026-08-01', warrantyMonths: 60, maturityDays: 30,
      scopeConfirmed: true, supplierRating: 4.5, note: 'Prověřeno.',
    };
    await saveBidComparisonConfig(folder, config);
    await expect(loadBidComparisonConfig(folder)).resolves.toEqual(config);
    expect(JSON.parse(await readFile(path.join(folder, BID_COMPARISON_CONFIG_FILE), 'utf8'))).not.toHaveProperty('bearerToken');
  });

  it('odmítne cílový symlink a zápis s průchodem mimo složku', async () => {
    const folder = await tempFolder();
    const outside = path.join(await tempFolder(), 'outside.json');
    await writeFile(outside, '{}');
    await symlink(outside, path.join(folder, 'porovnani-nabidek.config.json'));
    await expect(atomicWriteWorkspaceFile(folder, 'porovnani-nabidek.config.json', '{}')).rejects.toThrow('symbolický odkaz');
    await expect(atomicWriteWorkspaceFile(folder, '../outside.json', '{}')).rejects.toThrow('Neplatný název');
  });

  it('odmítne poškozenou strukturu uloženého výsledku', async () => {
    const folder = await tempFolder();
    await writeFile(path.join(folder, BID_COMPARISON_RESULT_FILE), JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      requestId: 'request-1',
      algorithmVersion: '1.0.0',
      inputFingerprints: [],
      evaluation: {
        algorithmVersion: '1.0.0',
        requestedWeights: createDefaultBidComparisonConfig().weights,
        effectiveWeights: createDefaultBidComparisonConfig().weights,
        warnings: [],
        scores: 'poškozeno',
        anomalies: [],
      },
      agentRecommendation: null,
    }));
    await expect(loadBidComparisonResult(folder)).rejects.toThrow('poškozená');
  });

  it('porovnávací moduly nemají databázové ani incidentní závislosti', async () => {
    const files = [
      '../desktop/main/services/bidComparisonScoring.ts',
      '../desktop/main/services/bidComparisonWorkspace.ts',
      '../desktop/main/services/bidComparisonAgent.ts',
      '../desktop/main/services/bidComparisonNormalization.ts',
      '../desktop/main/services/bidComparisonRunner.ts',
    ];
    const sources = await Promise.all(files.map((file) => readFile(new URL(file, import.meta.url), 'utf8')));
    sources.forEach((source) => {
      expect(source).not.toMatch(/from ['"].*supabase/i);
      expect(source).not.toMatch(/logIncident|incidentLogger/);
    });
  });
});
