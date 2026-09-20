import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseKrosWorkbook } from '@features/projects/budget/model/krosImport';
import { evaluateExpression } from '@features/projects/budget/model/budgetModel';
import { clearFigureResolution, findFigureUsages, getFigureConflicts, getPendingImportIssues, resolveFigureConflict } from '@features/projects/budget/model/figureConflicts';

function fixture() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Typ', 'Kód', 'Popis', 'MJ', 'Množství', 'J.cena', 'Cena celkem'],
    ['K', '001', 'Beton', 'm3', 2, 25, 50],
    ['VV', '', 'F1*2+F1', 'm3', 2], ['VV', '', 'F10*2', 'm3', 8],
  ]), 'Soupis');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Kód', 'Výměra'], ['F1', 2], ['F1', '2,00'], ['OK', 0], ['__proto__', 1],
  ]), 'Seznam figur A');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Kód', 'Výměra'], ['F1', 3], ['F1', 4], ['__proto__', 2],
  ]), 'Seznam figur B');
  return { workbook, document: parseKrosWorkbook(workbook) };
}

describe('figure conflict decisions', () => {
  it('retains every source cell across figure sheets and normalizes equal values', () => {
    const { document } = fixture();
    expect(getFigureConflicts(document).find(f => f.code === 'F1')).toEqual({
      code: 'F1', values: ['2', '3', '4'], sources: [
        { sheet: 'Seznam figur A', row: 2, cell: 'B2', value: '2' },
        { sheet: 'Seznam figur A', row: 3, cell: 'B3', value: '2' },
        { sheet: 'Seznam figur B', row: 2, cell: 'B2', value: '3' },
        { sheet: 'Seznam figur B', row: 3, cell: 'B3', value: '4' },
      ],
    });
    expect(Object.hasOwn(document.figures, 'F1')).toBe(false);
    expect(document.figures.OK).toBe('0');
  });

  it('finds exact VV identifiers once per row, including excluded sheets', () => {
    const { document } = fixture();
    document.sheets[0].selected = false;
    expect(findFigureUsages(document).get('F1')).toMatchObject([
      { sheet: 'Soupis', row: 3, expression: 'F1*2+F1', selected: false },
    ]);
  });

  it('includes the complete parent item and all its rows without matching another item by code', () => {
    const { document } = fixture();
    const original = structuredClone(document);
    const usage = findFigureUsages(document).get('F1')![0];
    expect(usage.item).toEqual(document.nodes.find(node => node.kind === 'K'));
    expect(usage.lines.map(node => node.description)).toEqual(['F1*2+F1', 'F10*2']);
    expect(document).toEqual(original);
    const unrelated = { ...usage.item!, id: 'other-item', sheetId: 'other-sheet' };
    document.nodes.push(unrelated);
    usage.node.parentId = unrelated.id;
    const orphan = findFigureUsages(document).get('F1')![0];
    expect(orphan.item).toBeUndefined();
    expect(orphan.lines).toEqual([usage.node]);
  });

  it('retains every related line and usage beyond the former fifty-row limit', () => {
    const { document } = fixture();
    const template = document.nodes.find(node => node.kind === 'VV')!;
    document.nodes.push(...Array.from({ length: 60 }, (_, i) => ({ ...template, id: `extra-${i}`, order: 10 + i, source: { ...template.source, row: 10 + i } })));
    const usages = findFigureUsages(document).get('F1')!;
    expect(usages).toHaveLength(61);
    expect(usages[0].lines).toHaveLength(62);
    expect(usages[0].lines.at(-1)?.id).toBe('extra-59');
  });

  it('persists and reverses an explicit choice without changing prices or original sources', () => {
    const { document } = fixture();
    const resolved = resolveFigureConflict(document, 'F1', '3', 'source');
    expect(resolved.nodes).toEqual(document.nodes);
    expect(resolved.issues).toEqual(document.issues);
    expect(resolved.figureResolutions?.F1).toEqual({ value: '3', origin: 'source' });
    expect(evaluateExpression('F1*2', JSON.parse(JSON.stringify(resolved)).figures)).toBe('6');
    expect(getPendingImportIssues(resolved)[0].figures?.map(f => f.code)).toEqual(['__proto__']);
    expect(Object.hasOwn(document.figures, 'F1')).toBe(false);
    const cleared = clearFigureResolution(resolved, 'F1');
    expect(Object.hasOwn(cleared.figures, 'F1')).toBe(false);
    expect(getPendingImportIssues(cleared)[0].figures).toHaveLength(2);
  });

  it('supports decimal commas, zero, safe special keys and legacy conflicts without source cells', () => {
    const { document } = fixture();
    expect(resolveFigureConflict(document, 'F1', '-0,125', 'custom').figures.F1).toBe('-0.125');
    expect(resolveFigureConflict(document, 'F1', '0', 'custom').figures.F1).toBe('0');
    const special = resolveFigureConflict(document, '__proto__', '2', 'source');
    expect(Object.hasOwn(special.figures, '__proto__')).toBe(true);
    expect(evaluateExpression('__proto__+1', special.figures)).toBe('3');
    expect(Object.getPrototypeOf(special.figures)).toBe(Object.prototype);
    const legacy = { ...document, issues: [{ sheet: 'Old', row: 1, severity: 'warning' as const, kind: 'ambiguous-figures' as const, message: 'Conflict', figures: [{ code: 'F1', values: ['2', '3'] }] }] };
    expect(getPendingImportIssues(resolveFigureConflict(legacy, 'F1', '2', 'source'))).toEqual([]);
  });

  it.each(['', ' ', 'NaN', 'Infinity', '1e9', '1;alert(1)', '<script>', '9'.repeat(49)])('rejects invalid custom input %s', value => {
    expect(() => resolveFigureConflict(fixture().document, 'F1', value, 'custom')).toThrow();
  });

  it('rejects unknown codes and unlisted source values and clears choices on a fresh parse', () => {
    const { workbook, document } = fixture();
    expect(() => resolveFigureConflict(document, 'missing', '2', 'custom')).toThrow();
    expect(() => resolveFigureConflict(document, 'F1', '999', 'source')).toThrow();
    resolveFigureConflict(document, 'F1', '3', 'source');
    expect(parseKrosWorkbook(workbook).figureResolutions).toBeUndefined();
    expect(Object.hasOwn(parseKrosWorkbook(workbook).figures, 'F1')).toBe(false);
  });
});
