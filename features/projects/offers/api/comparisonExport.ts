import { compareOffer } from '@shared/offers/comparison.js';
import type { ComparisonDocument } from '../model/types';
export async function exportComparisonXlsx(document: ComparisonDocument, title: string): Promise<void> {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Porovnání', { views: [{ state: 'frozen', xSplit: 3, ySplit: 2 }] });
    const base = document.sources[0], offers = document.sources.slice(1);
    const results = offers.map(s => compareOffer(base.items, s.items, document.assignments[s.id] || []));
    sheet.addRow([title]);
    sheet.addRow(['Kód', 'Položka / objekt', 'Množství', ...offers.map(s => s.name)]);
    base.items.forEach((item, i) => { const row = sheet.addRow([item.code, `${item.group} / ${item.description}`, `${item.quantity ?? '—'} ${item.unit}`, ...results.map(r => r.rows[i].comparableTotal ?? (r.rows[i].priceStatus === 'different-scope' ? 'Jiný rozsah' : r.rows[i].priceStatus === 'missing-price' ? 'Chybí cena' : 'Nespárováno'))]); if (i % 2 === 1)
        row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0ECE5' } }; }); });
    sheet.addRow(['', 'Srovnatelný rozsah', '', ...results.map(r => `${r.pricedCount ? r.total : '—'} (${r.pricedCount}/${base.items.length}${r.complete ? '' : ', dílčí'})`)]);
    sheet.columns.forEach((c, i) => { c.width = i === 1 ? 55 : i === 0 ? 18 : 28; });
    const notes = workbook.addWorksheet('Zdroje a výhrady');
    notes.addRow(['Dokument', 'SHA-256', 'Poznámka']);
    for (const source of document.sources) {
        notes.addRow([source.name, source.sha256, 'Snapshot zpracování; původní soubor se nemění.']);
        for (const note of source.notes)
            notes.addRow([source.name, '', note]);
        for (const item of source.items) if (item.note)
            notes.addRow([source.name, '', `${item.code} ${item.description}; ${item.source.sheet}:${item.source.row} — ${item.note}`]);
    }
    for (let i = 0; i < offers.length; i++)
        for (const id of results[i].extraIds) {
            const item = offers[i].items.find(item => item.id === id)!;
            notes.addRow([offers[i].name, '', `Bez protějšku: ${item.code} ${item.description}; ${item.source.sheet}:${item.source.row}`]);
        }
    notes.addRow(['', '', 'Položky bez protějšku a rozdílné množství nejsou automaticky chybějící ceny. Ověřte měnu a režim DPH originálů.']);
    // Strings are written as strings, never formula objects, including user text starting with =.
    const bytes = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = window.document.createElement('a');
    a.href = url;
    a.download = 'porovnani-nabidek.xlsx';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportComparisonPdf(document: ComparisonDocument, title: string): Promise<void> {
    const { loadPdfRuntime, registerRobotoFont } = await import('@shared/pdf/pdfRuntime');
    const { jsPDF, autoTable, RobotoRegularBase64 } = await loadPdfRuntime();
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    registerRobotoFont(pdf, RobotoRegularBase64);
    pdf.setFont('Roboto');
    const base = document.sources[0], offers = document.sources.slice(1);
    for (let start = 0; start < offers.length; start += 3) {
        if (start)
            pdf.addPage();
        const batch = offers.slice(start, start + 3), results = batch.map(s => compareOffer(base.items, s.items, document.assignments[s.id] || []));
        pdf.setFontSize(13);
        pdf.text(title.slice(0, 100), 12, 12);
        pdf.setFontSize(9);
        pdf.text(`Skupina dodavatelů ${Math.floor(start / 3) + 1}/${Math.ceil(offers.length / 3)} · základna ${base.name.slice(0, 70)}`, 12, 19);
        autoTable(pdf, { startY: 25, margin: { left: 12, right: 12, top: 20, bottom: 15 }, styles: { font: 'Roboto', fontSize: 8, cellPadding: 2, lineWidth: 0.15, lineColor: [201, 193, 181] }, headStyles: { fillColor: [101, 103, 107] }, bodyStyles: { fillColor: [240, 236, 229] }, alternateRowStyles: { fillColor: [255, 255, 255] }, head: [['Kód', 'Objekt / položka', 'Množství', ...batch.map(s => s.name)]], body: base.items.map((item, i) => [item.code, `${item.group}\n${item.description}`, `${item.quantity ?? '—'} ${item.unit}`, ...results.map(r => r.rows[i].comparableTotal ?? (r.rows[i].priceStatus === 'different-scope' ? 'Jiný rozsah' : r.rows[i].priceStatus === 'missing-price' ? 'Chybí cena' : 'Nespárováno'))]), foot: [['', 'Srovnatelný rozsah', '', ...results.map(r => `${r.pricedCount ? r.total : '—'} · ${r.pricedCount}/${base.items.length}${r.complete ? '' : ' (dílčí)'}`)]], showFoot: 'lastPage' });
    }
    pdf.addPage();
    pdf.setFontSize(13);
    pdf.text('Zdroje, původní poznámky a výhrady', 12, 12);
    const warnings: string[][] = [];
    for (const source of document.sources) {
        warnings.push([source.name, `SHA-256: ${source.sha256}`]);
        for (const note of source.notes)
            warnings.push([source.name, note]);
        for (const item of source.items) if (item.note)
            warnings.push([source.name, `${item.code} ${item.description}; ${item.source.sheet}:${item.source.row} — ${item.note}`]);
        if (source !== base) {
            const result = compareOffer(base.items, source.items, document.assignments[source.id] || []);
            for (const id of result.extraIds) {
                const item = source.items.find(i => i.id === id)!;
                warnings.push([source.name, `Bez protějšku: ${item.code} ${item.description}; ${item.source.sheet}:${item.source.row}`]);
            }
        }
    }
    warnings.push(['Rozsah', 'Ověřte shodnou měnu a režim DPH zdrojů. Neúplné součty nejsou celkové ceny nabídek. Chyba OCR není důkazem chybějící položky.']);
    autoTable(pdf, { startY: 20, styles: { font: 'Roboto', fontSize: 8 }, head: [['Dokument', 'Zdroj / výhrada']], body: warnings });
    pdf.save('porovnani-nabidek.pdf');
}
