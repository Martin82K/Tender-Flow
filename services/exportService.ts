import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DemandCategory, Bid, ProjectDetails, TenderPlanItem } from '../types';
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
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
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
    ['#', 'Firma', 'Kontaktní osoba', 'Email', 'Telefon', 'Cena', '1. kolo', '2. kolo', '3. kolo', 'Stav', 'Tagy', 'Poznámky']
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
  markdown += `| # | Firma | Kontakt | Email | Telefon | Cena | Stav |\n`;
  markdown += `|---|-------|---------|-------|---------|------|------|\n`;

  bids.forEach((bid, index) => {
    markdown += `| ${index + 1} | ${bid.companyName} | ${bid.contactPerson} | ${bid.email || '-'} | ${bid.phone || '-'} | ${bid.price || '?'} | ${getStatusLabel(bid.status)} |\n`;
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
    bid.priceHistory?.[1] || '-',
    bid.priceHistory?.[2] || '-',
    bid.priceHistory?.[3] || '-',
    getStatusLabel(bid.status)
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['#', 'Firma', 'Kontakt', 'Email', 'Telefon', 'Cena', '1.kolo', '2.kolo', '3.kolo', 'Stav']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2, font: 'Roboto' },
    headStyles: { fillColor: [71, 85, 105], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 40 },
      2: { cellWidth: 30 },
      3: { cellWidth: 45 },
      4: { cellWidth: 25 },
      5: { cellWidth: 25 },
      6: { cellWidth: 22 },
      7: { cellWidth: 22 },
      8: { cellWidth: 22 },
      9: { cellWidth: 25 }
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
