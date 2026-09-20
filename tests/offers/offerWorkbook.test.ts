import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { extractOfferItems, readOfferWorkbook } from '../../features/projects/offers/model/offerWorkbook';
const workbook = (rows: unknown[][]) => { const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Položky'); return book; };
const parse = (rows: unknown[][]) => { const data = readOfferWorkbook(XLSX.write(workbook(rows), { type: 'array', bookType: 'xlsx' })); return extractOfferItems(data.workbook, data.mappings); };
describe('offer workbook mapping', () => {
  it('reads differently ordered columns without changing the source', () => {
    const result = parse([['Popis', 'Množství', 'MJ', 'Kód', 'J. cena'], ['Omítka', 2, 'm2', '001', 12.5]]);
    expect(result.items[0]).toMatchObject({ code: '001', quantity: '2', total: '25.00', source: { sheet: 'Položky', row: 2 } });
  });
  it('retains unpriced items and original terms', () => {
    const result = parse([['Kód', 'Popis', 'MJ', 'Množství', 'Celkem'], ['1', 'Malba', 'm2', 10], ['', 'Doprava dle skutečnosti']]);
    expect(result.items[0].total).toBeNull(); expect(result.notes[0]).toContain('Doprava dle skutečnosti');
  });
  it('rejects Excel error codes rather than interpreting them as prices', () => {
    const book = workbook([['Popis', 'MJ', 'Množství', 'Celkem'], ['Malba', 'm2', 10, 0]]);
    book.Sheets.Položky.D2 = { t: 'e', v: 7 };
    expect(() => extractOfferItems(book, [{ sheet: 'Položky', headerRow: 1, columns: { description: 0, unit: 1, quantity: 2, total: 3 } }])).toThrow('chybová buňka');
  });
});
