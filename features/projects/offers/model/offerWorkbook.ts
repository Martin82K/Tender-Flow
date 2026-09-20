import * as XLSX from 'xlsx';
import { inspectXlsxArchive } from '@features/projects/budget/model/krosImport';
import { decimal, multiplyMoney, normalizeSearch } from '@features/projects/budget/model/budgetModel';
import { validateItems } from '@shared/offers/comparison.js';
import type { OfferItem } from '@shared/offers/comparison.js';

export type OfferColumn = 'code' | 'description' | 'unit' | 'quantity' | 'unitPrice' | 'total' | 'group' | 'note';
export interface OfferSheetMapping { sheet: string; headerRow: number; columns: Partial<Record<OfferColumn, number>> }
export interface OfferWorkbook { workbook: XLSX.WorkBook; mappings: OfferSheetMapping[] }
const patterns: Record<OfferColumn, RegExp> = {
  code: /^(kod|kod polozky|cislo polozky)$/, description: /^(popis|nazev|popis polozky|nazev polozky)$/,
  unit: /^(mj|m\.j\.|jednotka|merna jednotka)$/, quantity: /^(mnozstvi|pocet|vymera)$/,
  unitPrice: /^(j\.?\s*cena|jednotkova cena)/, total: /^(cena celkem|celkem|celkova cena)/,
  group: /^(objekt|soubor|oddil)$/, note: /^poznamka/,
};
export function readOfferWorkbook(bytes: ArrayBuffer): OfferWorkbook {
  inspectXlsxArchive(bytes);
  const workbook = XLSX.read(bytes, { type: 'array', cellFormula: true, cellHTML: false, sheetRows: 10002 });
  if (workbook.SheetNames.length > 100) throw new Error('Porovnání podporuje nejvýše 100 listů.');
  const mappings: OfferSheetMapping[] = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'] || 'A1');
    if (range.e.r > 10000 || range.e.c > 127) throw new Error('List překročil limit 10 000 řádků nebo 128 sloupců.');
    for (let r = 0; r <= Math.min(range.e.r, 49); r++) {
      const columns: OfferSheetMapping['columns'] = {};
      for (let c = 0; c <= range.e.c; c++) {
        const label = normalizeSearch(String(sheet[XLSX.utils.encode_cell({ r, c })]?.v ?? ''));
        for (const key of Object.keys(patterns) as OfferColumn[]) if (patterns[key].test(label)) columns[key] ??= c;
      }
      if (columns.description !== undefined && columns.quantity !== undefined) { mappings.push({ sheet: name, headerRow: r + 1, columns }); break; }
    }
  }
  return { workbook, mappings };
}
export function extractOfferItems(workbook: XLSX.WorkBook, mappings: OfferSheetMapping[]): { items: OfferItem[]; notes: string[] } {
  const items: OfferItem[] = [], notes: string[] = [], sheets = new Set<string>();
  for (const mapping of mappings) {
    const sheet = workbook.Sheets[mapping.sheet];
    if (!sheet || sheets.has(mapping.sheet) || !Number.isInteger(mapping.headerRow) || mapping.headerRow < 1) throw new Error('Neplatné mapování listu.');
    sheets.add(mapping.sheet);
    const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'] || 'A1');
    if (range.e.r > 10000 || range.e.c > 127) throw new Error('List překročil bezpečnostní limit.');
    if (mapping.columns.description === undefined || mapping.columns.quantity === undefined || mapping.columns.unit === undefined) throw new Error('Namapujte popis, množství a jednotku.');
    const selected = Object.values(mapping.columns).filter(c => c !== undefined);
    if (selected.some(c => !Number.isInteger(c) || c < 0 || c > 127) || new Set(selected).size !== selected.length) throw new Error('Každá role musí mít vlastní platný sloupec.');
    let group = '';
    for (let r = mapping.headerRow; r <= range.e.r; r++) {
      const get = (role: OfferColumn): unknown => {
        const c = mapping.columns[role]; if (c === undefined) return null;
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (cell?.t === 'e') throw new Error(`${mapping.sheet}, řádek ${r + 1}: chybová buňka Excelu.`);
        if (cell?.f && cell.v === undefined) throw new Error(`${mapping.sheet}, řádek ${r + 1}: vzorec nemá uložený výsledek.`);
        return role === 'code' ? (cell?.w ?? cell?.v ?? null) : (cell?.v ?? null);
      };
      const text = (role: OfferColumn) => String(get(role) ?? '').trim();
      const description = text('description'), code = text('code'), unit = text('unit');
      if (text('group')) group = text('group');
      const quantityRaw = get('quantity');
      if (!description && !code && quantityRaw === null) continue;
      if (!unit && (quantityRaw === null || quantityRaw === '')) {
        if (notes.length >= 10000) throw new Error('Příliš mnoho poznámek ve zdroji.');
        if (description) notes.push(`${mapping.sheet}:${r + 1} — ${description}${text('note') ? ' — ' + text('note') : ''}${get('total') !== null ? ' — souhrn: ' + text('total') : ''}`);
        if (description && !unit && quantityRaw === null) group = description;
        continue;
      }
      const quantity = decimal(quantityRaw), unitPrice = decimal(get('unitPrice')), suppliedTotal = decimal(get('total'));
      items.push({ id: `${mapping.sheet}:${r + 1}`, code, description, unit, quantity, unitPrice,
        total: suppliedTotal ?? (quantity !== null && unitPrice !== null ? multiplyMoney(quantity, unitPrice) : null),
        group, source: { sheet: mapping.sheet, row: r + 1 }, note: text('note') });
      if (items.length > 10000) throw new Error('Porovnání podporuje nejvýše 10 000 položek.');
    }
  }
  validateItems(items);
  if (!items.length) throw new Error('Nebyly nalezeny položky. Zkontrolujte listy a mapování.');
  return { items, notes };
}
