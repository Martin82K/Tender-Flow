// @vitest-environment node
// Optional local verification; the customer's XLSX stays outside the repository.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { readKrosFile } from '@features/projects/budget/model/krosImport';
import { aggregateBudget } from '@features/projects/budget/model/budgetTree';
import { isPriced } from '@features/projects/budget/model/types';

it.skipIf(!process.env.GLOBUS_SMOKE_FILE)('imports the supplied Globus workbook automatically with all source rows', () => {
  const start = performance.now();
  const document = readKrosFile(readFileSync(process.env.GLOBUS_SMOKE_FILE!));
  expect(document.sheets.map(sheet => sheet.role)).toEqual(['summary', 'items', 'items', 'items']);
  expect(document.sheets.slice(1).map(sheet => sheet.format)).toEqual(['globus', 'globus', 'globus']);
  expect(document.sheets.slice(1).map(sheet => sheet.object)).toEqual(['000', '201', '901']);
  expect(document.nodes.filter(isPriced)).toHaveLength(77);
  expect(document.nodes.filter(node => node.kind === 'section')).toHaveLength(12);
  expect(document.nodes.filter(node => node.kind === 'VV')).toHaveLength(120);
  expect(document.nodes.filter(node => node.sourceType === 'PP')).toHaveLength(77);
  expect(document.nodes.filter(node => node.sourceType === 'TS')).toHaveLength(77);
  expect(document.nodes.find(node => node.source.sheet === '201' && node.source.row === 9)).toMatchObject({ code: '014101R.1', quantity: '59.806', unitPrice: '286.35', total: '17125.45' });
  expect(aggregateBudget(document.nodes).total).toBe('5037008.85');
  expect(document.issues).toEqual([]);
  console.log(JSON.stringify({ milliseconds: performance.now() - start, items: document.nodes.filter(isPriced).length, issues: document.issues.length }));
});
