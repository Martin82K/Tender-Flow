import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DemandCategory, Bid, ProjectDetails } from '../types';

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
 * Remove Czech diacritics for PDF compatibility
 */
function removeDiacritics(text: string): string {
  const diacriticsMap: Record<string, string> = {
    'á': 'a', 'Á': 'A', 'č': 'c', 'Č': 'C', 'ď': 'd', 'Ď': 'D',
    'é': 'e', 'É': 'E', 'ě': 'e', 'Ě': 'E', 'í': 'i', 'Í': 'I',
    'ň': 'n', 'Ň': 'N', 'ó': 'o', 'Ó': 'O', 'ř': 'r', 'Ř': 'R',
    'š': 's', 'Š': 'S', 'ť': 't', 'Ť': 'T', 'ú': 'u', 'Ú': 'U',
    'ů': 'u', 'Ů': 'U', 'ý': 'y', 'Ý': 'Y', 'ž': 'z', 'Ž': 'Z'
  };
  return text.replace(/[áÁčČďĎéÉěĚíÍňŇóÓřŘšŠťŤúÚůŮýÝžŽ]/g, char => diacriticsMap[char] || char);
}

/**
 * Get status label without diacritics for PDF
 */
function getStatusLabelPDF(status: string): string {
  return removeDiacritics(getStatusLabel(status));
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
    ['PŘEHLED POPTÁVKY', '', '', '', '', '', '', '', '', '', '', ''],
    [],
    ['Projekt:', project.title],
    ['Kategorie:', category.title],
    ['SOD rozpočet:', formatMoney(category.sodBudget)],
    ['Plánovaný rozpočet:', formatMoney(category.planBudget)],
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
  const prices = bids.filter(b => b.price && b.price !== '?').map(b => parseMoney(b.price));
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  combinedData.push([]);
  combinedData.push(['STATISTIKY', '', '', '', '', '', '', '', '', '', '', '']);
  combinedData.push(['Celkem osloveno:', bids.length.toString()]);
  combinedData.push(['Obdržené nabídky:', offersCount.toString()]);
  if (avgPrice > 0) {
    combinedData.push(['Průměrná cena:', formatMoney(avgPrice)]);
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
  let markdown = `# Poptávka: ${category.title}\n\n`;
  markdown += `**Projekt:** ${project.title}\n\n`;

  if (category.deadline) {
    markdown += `**Termín:** ${formatDate(category.deadline)}\n\n`;
  }

  markdown += `**SOD rozpočet:** ${formatMoney(category.sodBudget)}\n`;
  markdown += `**Plánovaný rozpočet:** ${formatMoney(category.planBudget)}\n\n`;

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
  const prices = bids.filter(b => b.price && b.price !== '?').map(b => parseMoney(b.price));
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  markdown += `\n## Statistiky\n\n`;
  markdown += `- **Celkem osloveno:** ${bids.length}\n`;
  markdown += `- **Obdržené nabídky:** ${offersCount}\n`;
  if (avgPrice > 0) {
    markdown += `- **Průměrná cena:** ${formatMoney(avgPrice)}\n`;
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

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Prehled poptavky', 14, 15);

  // Project info - two columns for better space usage
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  doc.text(`Projekt: ${removeDiacritics(project.title)}`, 14, 25);
  doc.text(`Kategorie: ${removeDiacritics(category.title)}`, 14, 31);

  // Format money without Kč symbol for PDF (use CZK instead)
  const formatMoneyPDF = (value: number) =>
    new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(value) + ' CZK';

  doc.text(`SOD rozpocet: ${formatMoneyPDF(category.sodBudget)}`, 150, 25);
  doc.text(`Planovany rozpocet: ${formatMoneyPDF(category.planBudget)}`, 150, 31);

  if (category.deadline) {
    doc.text(`Termin: ${formatDate(category.deadline)}`, 14, 37);
  }

  // Table with round prices - all text without diacritics
  const tableData = bids.map((bid, index) => [
    (index + 1).toString(),
    removeDiacritics(bid.companyName),
    removeDiacritics(bid.contactPerson),
    bid.email || '-',
    bid.phone || '-',
    bid.price ? removeDiacritics(bid.price) : '?',
    bid.priceHistory?.[1] ? removeDiacritics(bid.priceHistory[1]) : '-',
    bid.priceHistory?.[2] ? removeDiacritics(bid.priceHistory[2]) : '-',
    bid.priceHistory?.[3] ? removeDiacritics(bid.priceHistory[3]) : '-',
    getStatusLabelPDF(bid.status)
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['#', 'Firma', 'Kontakt', 'Email', 'Telefon', 'Cena', '1.kolo', '2.kolo', '3.kolo', 'Stav']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' },
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
  const prices = bids.filter(b => b.price && b.price !== '?').map(b => parseMoney(b.price));
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Statistiky:', 14, finalY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Celkem osloveno: ${bids.length}`, 14, finalY + 6);
  doc.text(`Obdrzene nabidky: ${offersCount}`, 14, finalY + 12);
  if (avgPrice > 0) {
    doc.text(`Prumerna cena: ${formatMoneyPDF(avgPrice)}`, 14, finalY + 18);
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(
      `Exportovano: ${formatDate(new Date().toISOString())} | Strana ${i} z ${pageCount}`,
      14,
      doc.internal.pageSize.height - 10
    );
  }

  // Download
  const filename = `poptavka_${category.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
