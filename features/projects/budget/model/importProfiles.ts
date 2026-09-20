import { normalizeSearch } from './budgetModel';
import type { BudgetImportFormat } from './types';

type ImportColumns = Record<'kind' | 'code' | 'description' | 'unit' | 'quantity' | 'unitPrice' | 'total', number>;
interface ImportProfile {
  format: BudgetImportFormat;
  labels: Record<keyof ImportColumns, RegExp>;
  required: Array<keyof ImportColumns>;
  headerRows: number;
}

// Match the workbook structure, never its filename, image or embedded instructions.
// New formats belong here; archive limits, source preservation and validation stay shared.
const profiles: ImportProfile[] = [
  {
    format: 'kros', headerRows: 1, required: ['kind', 'code', 'description', 'unit', 'quantity'],
    labels: {
      kind: /^typ$/, code: /^kod$/, description: /^popis$/, unit: /^mj$/,
      quantity: /^mnozstvi$/, unitPrice: /^j\.?\s*cena/, total: /^(cena celkem|celkem)/,
    },
  },
  {
    format: 'globus', headerRows: 2, required: ['kind', 'code', 'description', 'unit', 'quantity'],
    labels: {
      kind: /^typ$/, code: /^kod polozky$/, description: /^nazev polozky$/, unit: /^mj$/,
      quantity: /^mnozstvi$/, unitPrice: /^(jednotkova|jednotkova cena|cena jednotkova)(\s*\[.*\])?$/,
      total: /^(celkem|cena celkem)(\s*\[.*\])?$/,
    },
  },
];

const label = (value: unknown) => normalizeSearch(value == null ? '' : String(value)).trim().replace(/\s+/g, ' ');

function columnsFor(rows: unknown[][], header: number, profile: ImportProfile): ImportColumns {
  const labels = rows[header]?.map(label) ?? [];
  const second = profile.headerRows === 2 ? rows[header + 1]?.map(label) ?? [] : [];
  const column = (key: keyof ImportColumns) => {
    const pattern = profile.labels[key];
    const first = labels.findIndex(value => pattern.test(value));
    // Only price labels can be on the second tier of the Globus header.
    return first >= 0 || (key !== 'unitPrice' && key !== 'total') ? first : second.findIndex(value => pattern.test(value));
  };
  return { kind: column('kind'), code: column('code'), description: column('description'), unit: column('unit'), quantity: column('quantity'), unitPrice: column('unitPrice'), total: column('total') };
}

export function detectBudgetLayout(rows: unknown[][], headerRow?: number) {
  const candidates = headerRow === undefined ? rows.map((_, index) => index) : [headerRow];
  for (const header of candidates) {
    for (const profile of profiles) {
      const columns = columnsFor(rows, header, profile);
      if (profile.required.every(key => columns[key] >= 0)) return { format: profile.format, header, columns };
    }
  }
  return undefined;
}

export function globusIdentity(rows: unknown[][], header: number, columns: ImportColumns) {
  const row = rows.slice(0, header).find(values => label(values[columns.kind]) === 'o' && values.some(value => label(value) === 'rozpocet:'));
  const value = (column: number) => row?.[column] == null ? '' : String(row[column]).trim();
  return { object: value(columns.code), title: value(columns.description) };
}

export function isGlobusColumnGuide(row: unknown[], columns: ImportColumns): boolean {
  // EstiCon exports a helper row containing zero-based column indexes after its header.
  // Check by the detected field positions so reordered columns remain supported.
  return Object.entries({ kind: 0, code: 2, description: 4, unit: 5, quantity: 6, unitPrice: 7, total: 8 })
    .every(([key, index]) => String(row[columns[key as keyof ImportColumns]]) === String(index));
}
