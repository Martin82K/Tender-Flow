import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';

// Reproducible, local-only training files. No macros, links, personal data or credentials.
const workbook = new ExcelJS.Workbook();
workbook.creator = 'Tender Flow — syntetická ukázka';
workbook.created = workbook.modified = new Date('2026-09-16T10:00:00Z');
for (const [name, items] of [
  ['Elektro', [[1, 'Kabelový rozvod — ukázka', 100, 'm', 80, '741001', ''], [2, 'Rozvaděč — ukázka', 1, 'ks', 12000, '741002', '']]],
  ['Slaboproud', [[3, 'Datová zásuvka — ukázka', 10, 'ks', 650, '742001', '']]],
]) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(['Pořadí', 'Popis', 'Množství', 'MJ', 'Jednotková cena', 'Kód / značka', 'Oddíl']);
  sheet.addRow(['', '', '', '', '', 'D', name]);
  items.forEach(item => sheet.addRow(item));
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach(column => { column.width = 22; });
  sheet.getColumn(2).width = 34;
  await sheet.protect('ukazka', { selectLockedCells: true, selectUnlockedCells: true });
}
await workbook.xlsx.writeFile('public/user-manual/assets/javor-rozpocet.xlsx');
await writeFile('public/user-manual/assets/javor-kontakty.csv', '\ufeffFirma;Specializace;Kontaktní osoba;E-mail;Telefon;Město\nDub Instalace — ukázka;Elektroinstalace;Irena Modelová;irena@example.com;+420 000 000 005;Brno\nBuk Mont — ukázka;Slaboproud;Tomáš Ukázkový;tomas@example.com;+420 000 000 006;Olomouc\n');
console.log('Created synthetic CSV and XLSX training files.');
