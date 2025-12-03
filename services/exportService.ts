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
 * Parse money string to number
 */
function parseMoney(value: string): number {
  if (!value || value === '?' || value === '-') return 0;
  const cleanStr = value.replace(/[^0-9,.]/g, '').replace(',', '.');
  const val = parseFloat(cleanStr);
  return isNaN(val) ? 0 : val;
}

/**
 * Export to XLSX format
 */
export function exportToXLSX(
  category: DemandCategory,
  bids: Bid[],
  project: ProjectDetails
): void {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Přehled poptávky
  const overviewData = [
    ['Přehled poptávky'],
    [],
    ['Projekt:', project.title],
    ['Kategorie:', category.title],
    ['SOD rozpočet:', formatMoney(category.sodBudget)],
    ['Plánovaný rozpočet:', formatMoney(category.planBudget)],
    ...(category.deadline ? [['Termín poptávky:', formatDate(category.deadline)]] : []),
    ['Datum exportu:', formatDate(new Date().toISOString())],
    [],
    ['Popis:'],
    [category.description || '-']
  ];

  const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Přehled');

  // Sheet 2: Seznam dodavatelů
  const headers = ['#', 'Firma', 'Kontaktní osoba', 'Email', 'Telefon', 'Cena', 'Stav', 'Tagy', 'Poznámky'];
  
  const bidRows = bids.map((bid, index) => [
    index + 1,
    bid.companyName,
    bid.contactPerson,
    bid.email || '-',
    bid.phone || '-',
    bid.price || '?',
    getStatusLabel(bid.status),
    bid.tags ? bid.tags.join(', ') : '-',
    bid.notes || '-'
  ]);

  const bidsData = [headers, ...bidRows];
  
  // Add statistics
  const offersCount = bids.filter(b => b.status === 'offer' || b.status === 'shortlist' || b.status === 'sod').length;
  const prices = bids.filter(b => b.price && b.price !== '?').map(b => parseMoney(b.price));
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  
  bidsData.push([]);
  bidsData.push(['Statistiky']);
  bidsData.push(['Celkem osloveno:', bids.length.toString()]);
  bidsData.push(['Obdržené nabídky:', offersCount.toString()]);
  if (avgPrice > 0) {
    bidsData.push(['Průměrná cena:', formatMoney(avgPrice)]);
  }

  const bidsSheet = XLSX.utils.aoa_to_sheet(bidsData);
  
  // Set column widths
  bidsSheet['!cols'] = [
    { wch: 5 },   // #
    { wch: 25 },  // Firma
    { wch: 20 },  // Kontakt
    { wch: 25 },  // Email
    { wch: 15 },  // Telefon
    { wch: 15 },  // Cena
    { wch: 15 },  // Stav
    { wch: 20 },  // Tagy
    { wch: 30 }   // Poznámky
  ];

  XLSX.utils.book_append_sheet(workbook, bidsSheet, 'Dodavatelé');

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
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Poptávka', 14, 20);
  
  // Project info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  let yPos = 35;
  
  doc.text(`Projekt: ${project.title}`, 14, yPos);
  yPos += 7;
  doc.text(`Kategorie: ${category.title}`, 14, yPos);
  yPos += 7;
  
  if (category.deadline) {
    doc.text(`Termín: ${formatDate(category.deadline)}`, 14, yPos);
    yPos += 7;
  }
  
  doc.text(`SOD rozpočet: ${formatMoney(category.sodBudget)}`, 14, yPos);
  yPos += 7;
  doc.text(`Plánovaný rozpočet: ${formatMoney(category.planBudget)}`, 14, yPos);
  yPos += 10;
  
  // Table
  const tableData = bids.map((bid, index) => [
    (index + 1).toString(),
    bid.companyName,
    bid.contactPerson,
    bid.email || '-',
    bid.phone || '-',
    bid.price || '?',
    getStatusLabel(bid.status)
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Firma', 'Kontakt', 'Email', 'Telefon', 'Cena', 'Stav']],
    body: tableData,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 35 },
      2: { cellWidth: 30 },
      3: { cellWidth: 40 },
      4: { cellWidth: 25 },
      5: { cellWidth: 25 },
      6: { cellWidth: 25 }

    },
    margin: { top: 10 }
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
  doc.text(`Obdržené nabídky: ${offersCount}`, 14, finalY + 12);
  if (avgPrice > 0) {
    doc.text(`Průměrná cena: ${formatMoney(avgPrice)}`, 14, finalY + 18);
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
