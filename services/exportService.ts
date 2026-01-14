import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DemandCategory, Bid, ProjectDetails, TenderPlanItem, Subcontractor, StatusConfig } from '../types';
import { RobotoRegularBase64 } from '../fonts/roboto-regular';

/**
 * Format money for display
 */
function formatMoney(value: number): string {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('cs-CZ');
}

/**
 * Get status label in Czech
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    contacted: 'Oslovení',
    sent: 'Odesláno',
    offer: 'Nabídka',
    shortlist: 'Užší výběr',
    sod: 'Jednání o SOD',
    rejected: 'Zamítnuto'
  };
  return labels[status] || status;
}

/**
 * Register Roboto font with jsPDF for Czech diacritics support
 */
function registerRobotoFont(doc: jsPDF): void {
  doc.addFileToVFS('Roboto-Regular.ttf', RobotoRegularBase64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal', 'Identity-H');
}

/**
 * Parse money string to number
 */
function parseMoney(value: string): number {
  if (!value || value === '?' || value === '-') return 0;
  const cleanStr = value.replace(/[^0-9,.]/g, '').replace(',', '.');
  const val = parseFloat(cleanStr);
  return isNaN(val) ? 0 : val;
}

/**
 * Export to XLSX format with styling
 */
export function exportToXLSX(
  category: DemandCategory,
  bids: Bid[],
  project: ProjectDetails
): void {
  const workbook = XLSX.utils.book_new();

  // Combined data - overview + suppliers on one sheet
  const combinedData: (string | number)[][] = [
    ['ZÁPIS O VÝBĚRU', '', '', '', '', '', '', '', '', '', '', ''],
    [],
    ['Projekt:', project.title],
    ['Kategorie:', category.title],
    ['SOD rozpočet:', formatMoney(category.sodBudget)],
    ['Plánovaný náklad:', formatMoney(category.planBudget)],
    ...(category.deadline ? [['Termín poptávky:', formatDate(category.deadline)]] : []),
    ['Datum exportu:', formatDate(new Date().toISOString())],
    [],
    ['Popis:', category.description || '-'],
    [],
    [], // Empty row before suppliers table
    ['SEZNAM DODAVATELŮ', '', '', '', '', '', '', '', '', '', '', ''],
    [],
    ['#', 'Firma', 'Kontaktní osoba', 'Email', 'Telefon', 'Cena', 'Soutěž', '1. kolo', '2. kolo', '3. kolo', 'Stav', 'Tagy', 'Poznámky']
  ];

  const headerRowIndex = combinedData.length - 1; // 0-indexed row number of table header

  // Add bid rows
  bids.forEach((bid, index) => {
    combinedData.push([
      index + 1,
      bid.companyName,
      bid.contactPerson,
      bid.email || '-',
      bid.phone || '-',
      bid.price || '?',
      bid.priceHistory?.[0] || '-',
      bid.priceHistory?.[1] || '-',
      bid.priceHistory?.[2] || '-',
      bid.priceHistory?.[3] || '-',
      getStatusLabel(bid.status),
      bid.tags ? bid.tags.join(', ') : '-',
      bid.notes || '-'
    ]);
  });

  // Add statistics
  const offersCount = bids.filter(b => b.status === 'offer' || b.status === 'shortlist' || b.status === 'sod').length;
  combinedData.push([]);
  combinedData.push(['STATISTIKY', '', '', '', '', '', '', '', '', '', '', '']);
  combinedData.push(['Celkem osloveno:', bids.length.toString()]);
  combinedData.push(['Obdržené nabídky:', offersCount.toString()]);

  // Winner comparison
  const winnerBid = bids.find(b => b.status === 'sod');
  const winnerPrice = winnerBid ? parseMoney(winnerBid.price) : 0;

  if (winnerBid && winnerPrice > 0) {
    const sodDiff = winnerPrice - category.sodBudget;
    const planDiff = winnerPrice - category.planBudget;
    const sodPercent = category.sodBudget > 0 ? ((sodDiff / category.sodBudget) * 100).toFixed(1) : '0';
    const planPercent = category.planBudget > 0 ? ((planDiff / category.planBudget) * 100).toFixed(1) : '0';

    combinedData.push([]);
    combinedData.push(['BILANCE VÍTĚZE (Jednání o SOD)', '', '', '', '', '', '', '', '', '', '', '']);
    combinedData.push(['Vítěz:', winnerBid.companyName]);
    combinedData.push(['Cena vítěze:', formatMoney(winnerPrice)]);
    combinedData.push([
      'vs SOD rozpočet:',
      `${sodDiff >= 0 ? '+' : ''}${formatMoney(sodDiff)} (${sodDiff >= 0 ? '+' : ''}${sodPercent}%)`
    ]);
    combinedData.push([
      'vs Plánovaný náklad:',
      `${planDiff >= 0 ? '+' : ''}${formatMoney(planDiff)} (${planDiff >= 0 ? '+' : ''}${planPercent}%)`
    ]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(combinedData);

  // Set column widths
  sheet['!cols'] = [
    { wch: 5 },   // #
    { wch: 28 },  // Firma
    { wch: 22 },  // Kontakt
    { wch: 28 },  // Email
    { wch: 15 },  // Telefon
    { wch: 15 },  // Cena
    { wch: 14 },  // Soutěž
    { wch: 14 },  // 1. kolo
    { wch: 14 },  // 2. kolo
    { wch: 14 },  // 3. kolo
    { wch: 14 },  // Stav
    { wch: 18 },  // Tagy
    { wch: 35 }   // Poznámky
  ];

  // Merge cells for section titles
  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },  // PŘEHLED POPTÁVKY
    { s: { r: 12, c: 0 }, e: { r: 12, c: 5 } }, // SEZNAM DODAVATELŮ (row 13)
  ];

  // Set row heights for better readability
  sheet['!rows'] = [
    { hpt: 24 },  // Title row - taller
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, 'Poptávka');

  // Download file
  const filename = `poptavka_${category.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

/**
 * Export to Markdown format
 */
export function exportToMarkdown(
  category: DemandCategory,
  bids: Bid[],
  project: ProjectDetails
): void {
  let markdown = `# Zápis o výběru: ${category.title}\n\n`;
  markdown += `**Projekt:** ${project.title}\n\n`;

  if (category.deadline) {
    markdown += `**Termín:** ${formatDate(category.deadline)}\n\n`;
  }

  markdown += `**SOD rozpočet:** ${formatMoney(category.sodBudget)}\n`;
  markdown += `**Plánovaný náklad:** ${formatMoney(category.planBudget)}\n\n`;

  if (category.description) {
    markdown += `## Popis prací\n\n${category.description}\n\n`;
  }

  markdown += `## Seznam dodavatelů\n\n`;
  markdown += `| # | Firma | Kontakt | Email | Telefon | Cena | Soutěž | 1. kolo | 2. kolo | 3. kolo | Stav |\n`;
  markdown += `|---|-------|---------|-------|---------|------|--------|---------|---------|---------|------|\n`;

  bids.forEach((bid, index) => {
    markdown += `| ${index + 1} | ${bid.companyName} | ${bid.contactPerson} | ${bid.email || '-'} | ${bid.phone || '-'} | ${bid.price || '?'} | ${bid.priceHistory?.[0] || '-'} | ${bid.priceHistory?.[1] || '-'} | ${bid.priceHistory?.[2] || '-'} | ${bid.priceHistory?.[3] || '-'} | ${getStatusLabel(bid.status)} |\n`;
  });

  // Statistics
  const offersCount = bids.filter(b => b.status === 'offer' || b.status === 'shortlist' || b.status === 'sod').length;
  markdown += `\n## Statistiky\n\n`;
  markdown += `- **Celkem osloveno:** ${bids.length}\n`;
  markdown += `- **Obdržené nabídky:** ${offersCount}\n`;

  // Winner comparison
  const winnerBid = bids.find(b => b.status === 'sod');
  const winnerPrice = winnerBid ? parseMoney(winnerBid.price) : 0;

  if (winnerBid && winnerPrice > 0) {
    const sodDiff = winnerPrice - category.sodBudget;
    const planDiff = winnerPrice - category.planBudget;
    const sodPercent = category.sodBudget > 0 ? ((sodDiff / category.sodBudget) * 100).toFixed(1) : '0';
    const planPercent = category.planBudget > 0 ? ((planDiff / category.planBudget) * 100).toFixed(1) : '0';

    markdown += `\n## Bilance vítěze (Jednání o SOD)\n\n`;
    markdown += `- **Vítěz:** ${winnerBid.companyName}\n`;
    markdown += `- **Cena vítěze:** ${formatMoney(winnerPrice)}\n`;
    markdown += `- **vs SOD rozpočet:** ${sodDiff >= 0 ? '+' : ''}${formatMoney(sodDiff)} (${sodDiff >= 0 ? '+' : ''}${sodPercent}%)\n`;
    markdown += `- **vs Plánovaný náklad:** ${planDiff >= 0 ? '+' : ''}${formatMoney(planDiff)} (${planDiff >= 0 ? '+' : ''}${planPercent}%)\n`;
  }

  markdown += `\n---\n\n`;
  markdown += `*Exportováno: ${formatDate(new Date().toISOString())}*\n`;

  // Download file
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `poptavka_${category.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export to PDF format
 */
export function exportToPDF(
  category: DemandCategory,
  bids: Bid[],
  project: ProjectDetails
): void {
  // Create PDF in landscape orientation
  const doc = new jsPDF({ orientation: 'landscape' });

  // Register Roboto font for Czech diacritics support
  registerRobotoFont(doc);

  // Title
  doc.setFontSize(18);
  doc.setFont('Roboto', 'normal');
  doc.text('Zápis o výběru', 14, 15);

  // Project info - two columns for better space usage
  doc.setFontSize(10);
  doc.setFont('Roboto', 'normal');

  doc.text(`Projekt: ${project.title}`, 14, 25);
  doc.text(`Kategorie: ${category.title}`, 14, 31);

  // Format money without Kč symbol for PDF (use CZK instead)
  const formatMoneyPDF = (value: number) =>
    new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(value) + ' CZK';

  doc.text(`SOD rozpočet: ${formatMoneyPDF(category.sodBudget)}`, 150, 25);
  doc.text(`Plánovaný náklad: ${formatMoneyPDF(category.planBudget)}`, 150, 31);

  if (category.deadline) {
    doc.text(`Termín: ${formatDate(category.deadline)}`, 14, 37);
  }

  // Table with round prices - now with proper Czech diacritics
  const tableData = bids.map((bid, index) => [
    (index + 1).toString(),
    bid.companyName,
    bid.contactPerson,
    bid.email || '-',
    bid.phone || '-',
    bid.price || '?',
    bid.priceHistory?.[0] || '-',
    bid.priceHistory?.[1] || '-',
    bid.priceHistory?.[2] || '-',
    // bid.priceHistory?.[3] || '-', // Omit 3rd round in PDF to save space if needed, or keep it. Let's try to fit it.
    getStatusLabel(bid.status)
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['#', 'Firma', 'Kontakt', 'Email', 'Telefon', 'Cena', 'Soutěž', '1.kolo', '2.kolo', 'Stav']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2, font: 'Roboto' },
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'normal' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 35 },
      2: { cellWidth: 25 },
      3: { cellWidth: 40 },
      4: { cellWidth: 25 },
      5: { cellWidth: 20 },
      6: { cellWidth: 20 },
      7: { cellWidth: 20 },
      8: { cellWidth: 20 },
      9: { cellWidth: 20 }
    },
    margin: { left: 14, right: 14 }
  });

  // Statistics
  const offersCount = bids.filter(b => b.status === 'offer' || b.status === 'shortlist' || b.status === 'sod').length;

  // Find winner (bid with status 'sod' - Jednání o SOD)
  const winnerBid = bids.find(b => b.status === 'sod');
  const winnerPrice = winnerBid ? parseMoney(winnerBid.price) : 0;

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Statistics Header
  doc.setFontSize(9);
  doc.setFont('Roboto', 'normal'); // Using normal weight but slightly larger size for header
  doc.text('Statistiky:', 14, finalY);

  // Statistics Content
  doc.setFontSize(8);
  doc.text(`Celkem osloveno: ${bids.length}`, 14, finalY + 5);
  doc.text(`Obdržené nabídky: ${offersCount}`, 14, finalY + 10);

  // Winner price balance section
  if (winnerBid && winnerPrice > 0) {
    const sodDiff = winnerPrice - category.sodBudget;
    const planDiff = winnerPrice - category.planBudget;
    const sodPercent = category.sodBudget > 0 ? ((sodDiff / category.sodBudget) * 100).toFixed(1) : '0';
    const planPercent = category.planBudget > 0 ? ((planDiff / category.planBudget) * 100).toFixed(1) : '0';

    // Winner Balance Header
    doc.setFontSize(9);
    doc.text('Bilance vítěze (Jednání o SOD):', 14, finalY + 18);

    // Winner Balance Content
    doc.setFontSize(8);
    doc.text(`  Vítěz: ${winnerBid.companyName}`, 14, finalY + 23);
    doc.text(`  Cena vítěze: ${formatMoneyPDF(winnerPrice)}`, 14, finalY + 28);
    doc.text(`  vs SOD rozpočet: ${sodDiff >= 0 ? '+' : ''}${formatMoneyPDF(sodDiff)} (${sodDiff >= 0 ? '+' : ''}${sodPercent}%)`, 14, finalY + 33);
    doc.text(`  vs Plánovaný náklad: ${planDiff >= 0 ? '+' : ''}${formatMoneyPDF(planDiff)} (${planDiff >= 0 ? '+' : ''}${planPercent}%)`, 14, finalY + 38);
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(
      `Exportováno: ${formatDate(new Date().toISOString())} | Strana ${i} z ${pageCount}`,
      14,
      doc.internal.pageSize.height - 10
    );
  }

  // Download
  const filename = `poptavka_${category.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}


/**
 * Export Tender Plan to XLSX
 */
export function exportTenderPlanToXLSX(items: TenderPlanItem[], projectTitle: string): void {
  const workbook = XLSX.utils.book_new();

  // Create data array
  const data: (string | number)[][] = [
    ['PLÁN VÝBĚROVÝCH ŘÍZENÍ', '', '', '', ''],
    ['Projekt:', projectTitle, '', '', ''],
    ['Datum exportu:', formatDate(new Date().toISOString()), '', '', ''],
    [],
    ['Název VŘ', 'Od (plán)', 'Do (plán)', 'Stav', 'ID Poptávky']
  ];

  items.forEach(item => {
    data.push([
      item.name,
      item.dateFrom ? formatDate(item.dateFrom) : '-',
      item.dateTo ? formatDate(item.dateTo) : '-',
      item.categoryId ? 'Vytvořeno' : 'Naplánováno',
      item.categoryId || '-'
    ]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  sheet['!cols'] = [
    { wch: 40 }, // Název
    { wch: 15 }, // Od
    { wch: 15 }, // Do
    { wch: 15 }, // Stav
    { wch: 20 }  // ID
  ];

  // Merge title
  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, 'Plán VŘ');

  const filename = `plan_vr_${projectTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

/**
 * Download Template for Tender Plan import (or just generic Tender import template)
 * As per request: "template for importing data into Tenders"
 */
export function downloadTenderImportTemplate(): void {
  const workbook = XLSX.utils.book_new();

  // Simplified template for creating Demands
  const data = [
    ['Název poptávky', 'Popis', 'SOD Rozpočet', 'Plánovaný náklad', 'Termín (Deadline)', 'Zahájení realizace', 'Konec realizace'],
    ['Příklad: Obklady koupelny', 'Detailní popis prací...', '150000', '120000', '2024-12-31', '2025-01-15', '2025-02-28']
  ];

  const sheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  sheet['!cols'] = [
    { wch: 40 }, // Název
    { wch: 50 }, // Popis
    { wch: 15 }, // SOD
    { wch: 15 }, // Plan
    { wch: 15 }, // Deadline
    { wch: 15 }, // Start
    { wch: 15 }  // End
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, 'Šablona importu');

  XLSX.writeFile(workbook, 'sablona_import_poptavky.xlsx');
}

/**
 * Helper to parse Excel date
 */
function parseExcelDate(value: any): string {
  if (!value) return '';

  // If it's a number (Excel serial date)
  if (typeof value === 'number') {
    // Excel date to JS Date
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }

  // If it's a string, try to parse
  if (typeof value === 'string') {
    // Try DD.MM.YYYY
    const czeDate = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (czeDate) {
      return `${czeDate[3]}-${czeDate[2].padStart(2, '0')}-${czeDate[1].padStart(2, '0')}`;
    }

    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  return '';
}

/**
 * Import Tender Plan from XLSX
 */
export async function importTenderPlanFromXLSX(file: File): Promise<Partial<TenderPlanItem>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        // Assume first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Get data as array of arrays
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          resolve([]);
          return;
        }

        // Find header row index (look for 'Název' or 'Name')
        let headerRowIndex = 0;
        let colMap: Record<string, number> = {};

        // Simple heuristic to find header row and map columns
        for (let r = 0; r < Math.min(jsonData.length, 10); r++) {
          const row = jsonData[r];
          const rowStr = row.map(c => String(c).toLowerCase()).join(' ');

          if (rowStr.includes('název') || rowStr.includes('name') || rowStr.includes('description') || rowStr.includes('popis')) {
            headerRowIndex = r;
            // Map columns
            row.forEach((cell: any, idx: number) => {
              const c = String(cell).toLowerCase().trim();
              if (c.includes('název') || c.includes('name') || c.includes('popis') || c.includes('položka')) colMap['name'] = idx;
              else if (c.includes('od') || c.includes('start') || c.includes('zahájení')) colMap['from'] = idx;
              else if (c.includes('do') || c.includes('end') || c.includes('konec') || c.includes('termín')) colMap['to'] = idx;
            });
            break;
          }
        }

        // If we didn't find specific headers, assume 0=Name, 1=From, 2=To? Or just skip?
        // Let's fallback to standard template columns if mapping failed for name
        if (colMap['name'] === undefined) {
          // Fallback: 0=Name, 4=Deadline (Termín), 5=Start, 6=End - based on our template
          colMap['name'] = 0;
          colMap['from'] = 5;
          colMap['to'] = 6;
          // Also check for deadline as "To" if From/To are missing?
          // Let's stick to the template structure we generate
        }

        const items: Partial<TenderPlanItem>[] = [];

        // Parse rows
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const name = row[colMap['name']];
          if (!name) continue;

          const dateFrom = colMap['from'] !== undefined ? parseExcelDate(row[colMap['from']]) : '';
          const dateTo = colMap['to'] !== undefined ? parseExcelDate(row[colMap['to']]) : '';

          // If dateTo is empty, maybe try deadline column (index 4 in template)?
          let finalDateTo = dateTo;
          if (!finalDateTo && row[4]) {
            finalDateTo = parseExcelDate(row[4]);
          }

          items.push({
            name: String(name).trim(),
            dateFrom: dateFrom,
            dateTo: finalDateTo
          });
        }

        resolve(items);
      } catch (err) {
        console.error("Error parsing Excel:", err);
        reject(err);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Export Contacts to XLSX
 */
export function exportContactsToXLSX(contacts: Subcontractor[], statuses: StatusConfig[]): void {
  const workbook = XLSX.utils.book_new();

  // Create data array
  const data: (string | number)[][] = [
    ['DATABÁZE KONTAKTŮ', '', '', '', '', '', '', '', ''],
    ['Datum exportu:', formatDate(new Date().toISOString()), '', '', '', '', '', '', ''],
    [],
    ['Firma', 'IČO', 'Region', 'Obory', 'Stav', 'Kontakt', 'Telefon', 'Email', 'Další kontakty']
  ];

  // Helper to find status label
  const getStatusLabel = (statusId: string) => {
    const s = statuses.find(s => s.id === statusId);
    return s ? s.label : statusId;
  };

  contacts.forEach(contact => {
    // Primary contact (first one)
    const primaryContact = contact.contacts[0] || { name: '', phone: '', email: '' };

    // Other contacts formatted
    const otherContacts = contact.contacts.slice(1).map(c =>
      `${c.name} (${c.phone || '-'}, ${c.email || '-'})`
    ).join('; ');

    data.push([
      contact.company,
      contact.ico || '-',
      contact.region || '-',
      contact.specialization.join(', '),
      getStatusLabel(contact.status),
      primaryContact.name,
      primaryContact.phone || '-',
      primaryContact.email || '-',
      otherContacts
    ]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  sheet['!cols'] = [
    { wch: 30 }, // Firma
    { wch: 12 }, // IČO
    { wch: 15 }, // Region
    { wch: 25 }, // Obory
    { wch: 15 }, // Stav
    { wch: 20 }, // Kontakt
    { wch: 15 }, // Telefon
    { wch: 25 }, // Email
    { wch: 40 }  // Další kontakty
  ];

  // Merge title
  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, 'Kontakty');

  const filename = `kontakty_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

/**
 * Export Contacts to CSV
 */
export function exportContactsToCSV(contacts: Subcontractor[], statuses: StatusConfig[]): void {
  // We can reuse the same structure but simpler for CSV
  const data: (string | number)[][] = [
    ['Firma', 'ICO', 'Region', 'Obory', 'Stav', 'Kontakt', 'Telefon', 'Email', 'Dalsi kontakty']
  ];

  const getStatusLabel = (statusId: string) => {
    const s = statuses.find(s => s.id === statusId);
    return s ? s.label : statusId;
  };

  contacts.forEach(contact => {
    const primaryContact = contact.contacts[0] || { name: '', phone: '', email: '' };
    const otherContacts = contact.contacts.slice(1).map(c =>
      `${c.name} (${c.phone || '-'}, ${c.email || '-'})`
    ).join('; ');

    data.push([
      contact.company,
      contact.ico || '',
      contact.region || '',
      contact.specialization.join(', '),
      getStatusLabel(contact.status),
      primaryContact.name,
      primaryContact.phone || '',
      primaryContact.email || '',
      otherContacts
    ]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(sheet);

  // Download logic for CSV
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `kontakty_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

