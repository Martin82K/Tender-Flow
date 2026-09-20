import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { unzipSync, zipSync } from 'fflate';
import { parseKrosWorkbook, readKrosFile } from '@features/projects/budget/model/krosImport';
import { aggregateBudget } from '@features/projects/budget/model/budgetTree';
import { isPriced } from '@features/projects/budget/model/types';

// Synthetic data with the supplied EstiCon layout; no customer workbook is committed.
export function globusWorkbook() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['EstiCon'], ['Rekapitulace ceny'], ['Objekt', 'Popis', 'Cena bez DPH'], ['000', 'Příprava', 50],
  ]), 'Rekapitulace');
  const sheet = XLSX.utils.aoa_to_sheet([
    ['EstiCon'], [null, null, null, null, 'Soupis prací objektu'],
    ['S', 'Stavba:', 'TEST', null, 'Testovací stavba'],
    ['O', 'Rozpočet:', '000', null, 'Příprava'],
    ['Typ', 'Poř. číslo', 'Kód položky', 'Varianta', 'Název Položky', 'MJ', 'Množství', 'Cena', null, 'Cenová soustava'],
    [null, null, null, null, null, null, null, 'Jednotková', 'Celkem'],
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    ['SD', null, '0', null, 'Příprava', null, null, null, 50],
    ['P', 1, '02911', 'a', 'Zaměření', 'KPL', 2, 25, 50],
    ['PP', null, null, null, 'Doplňující popis'],
    ['VV', null, null, null, '2*1 = 2,000 [A]'],
    ['TS', null, null, null, 'Technická specifikace'],
    ['SD', null, '1', null, 'Práce', null, null, null, 0],
    ['P', 2, '02911', 'b', 'Druhá položka', 'KPL', 0, 25, 0],
  ]);
  sheet.I9.f = 'ROUND(G9*H9,2)';
  XLSX.utils.book_append_sheet(workbook, sheet, '000');
  return workbook;
}

describe('automatic Globus import', () => {
  it('detects two-row headers, preserves source and creates sibling sections without double counting', () => {
    const document = readKrosFile(new Uint8Array(XLSX.write(globusWorkbook(), { type: 'array', bookType: 'xlsx' })));
    expect(document.sheets.map(s => s.role)).toEqual(['summary', 'items']);
    expect(document.sheets[1]).toMatchObject({ format: 'globus', object: '000', title: 'Příprava', headerRow: 5 });
    const items = document.nodes.filter(isPriced);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ code: '02911', description: 'Zaměření', sourceType: 'P', quantity: '2', unitPrice: '25', total: '50.00' });
    expect(items[0].source).toMatchObject({ sheet: '000', row: 9, cells: { D9: { value: 'a' }, I9: { value: 50, formula: 'ROUND(G9*H9,2)' } } });
    const sections = document.nodes.filter(n => n.kind === 'section');
    expect(sections).toHaveLength(2);
    expect(sections.map(n => n.parentId)).toEqual(['sheet:1', 'sheet:1']);
    expect(items.map(n => n.parentId)).toEqual(sections.map(n => n.id));
    expect(document.nodes.filter(n => n.parentId === items[0].id).map(n => [n.kind, n.sourceType, n.description])).toEqual([
      ['note', 'PP', 'Doplňující popis'], ['VV', 'VV', '2*1 = 2,000 [A]'], ['note', 'TS', 'Technická specifikace'],
    ]);
    expect(document.nodes.find(n => n.kind === 'VV')?.quantity).toBeNull();
    expect(document.nodes.some(n => n.source.row === 7)).toBe(false);
    expect(new Set(document.nodes.map(n => n.id)).size).toBe(document.nodes.length);
    expect(aggregateBudget(document.nodes).total).toBe('50.00');
    expect(document.issues).toEqual([]);
  });

  it('recognizes shifted headers and reordered columns without manual mapping or a logo', () => {
    const workbook = globusWorkbook();
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['000'], { header: 1, defval: null });
    rows[0] = [];
    const order = [4, 0, 6, 2, 5, 8, 7, 3, 1, 9];
    workbook.Sheets['000'] = XLSX.utils.aoa_to_sheet([[], [], ...rows.map(row => order.map(index => row[index]))]);
    const document = parseKrosWorkbook(workbook);
    expect(document.sheets[1]).toMatchObject({ format: 'globus', headerRow: 7, object: '000', title: 'Příprava' });
    expect(document.nodes.filter(isPriced).map(n => n.code)).toEqual(['02911', '02911']);
    expect(aggregateBudget(document.nodes).total).toBe('50.00');
    expect(document.nodes.filter(n => n.kind === 'note')).toHaveLength(2);
  });

  it('distinguishes missing prices from zero and never executes a formula without a cached value', () => {
    const workbook = globusWorkbook();
    delete workbook.Sheets['000'].H9;
    workbook.Sheets['000'].I9 = { t: 'n', f: 'WEBSERVICE("https://invalid.example")' };
    const document = parseKrosWorkbook(workbook);
    expect(document.nodes.filter(isPriced).map(n => [n.unitPrice, n.total])).toEqual([[null, null], ['25', '0.00']]);
    expect(document.nodes.filter(isPriced)[0].source.cells.I9.formula).toContain('WEBSERVICE');
    expect(document.issues.some(i => i.row === 9 && i.severity === 'error')).toBe(true);
    expect(aggregateBudget(document.nodes).incomplete).toBe(true);
  });

  it('keeps each object separate and honors explicit mapping overrides', () => {
    const workbook = globusWorkbook();
    const other = XLSX.utils.aoa_to_sheet(XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['000'], { header: 1 }));
    other.C4.v = '201'; other.E4.v = 'Most';
    XLSX.utils.book_append_sheet(workbook, other, '201');
    const document = parseKrosWorkbook(workbook, undefined, { '000': { object: 'SO 000', title: 'Vlastní název', columns: { unitPrice: 7 } } });
    expect(document.sheets[1]).toMatchObject({ object: 'SO 000', title: 'Vlastní název' });
    expect(document.sheets[2]).toMatchObject({ object: '201', title: 'Most' });
    expect(document.nodes.filter(n => n.kind === 'object')).toHaveLength(2);
    expect(document.nodes.filter(isPriced)).toHaveLength(4);
  });

  it('does not mistake a logo or incomplete headings for a supported item sheet', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['EstiCon'], ['Typ', 'Název položky'], ['P', 'Text']]), 'Neznámý');
    const document = parseKrosWorkbook(workbook);
    expect(document.sheets[0].role).toBe('unknown');
    expect(document.nodes).toEqual([]);
  });

  it.each(['xl/vbaProject.bin', 'xl/externalLinks/externalLink1.xml', 'xl/embeddings/object.bin'])('rejects active content %s before automatic recognition', entry => {
    const bytes = new Uint8Array(XLSX.write(globusWorkbook(), { type: 'array', bookType: 'xlsx' }));
    const archive = unzipSync(bytes);
    archive[entry] = new Uint8Array([1]);
    expect(() => readKrosFile(zipSync(archive))).toThrow('Makra, externí vazby a vložené objekty nejsou podporovány.');
  });

  it('detects KROS and Globus separately within one workbook', () => {
    const workbook = globusWorkbook();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['Typ', 'Kód', 'Popis', 'MJ', 'Množství', 'J.cena', 'Cena celkem'],
      ['M', '0001', 'Materiál', 'ks', 1, 10, 10],
    ]), 'KROS');
    const document = parseKrosWorkbook(workbook);
    expect(document.sheets.map(sheet => sheet.format)).toEqual([undefined, 'globus', 'kros']);
    expect(document.nodes.filter(isPriced)).toHaveLength(3);
    expect(aggregateBudget(document.nodes).total).toBe('60.00');
  });
});
