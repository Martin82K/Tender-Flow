import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RobotoRegularBase64 } from '@/fonts/roboto-regular';

/**
 * Row data structure for schedule export
 */
export interface ScheduleRow {
  label: string;
  subLabel?: string;
  start: Date | null;
  end: Date | null;
  kind: 'bar' | 'milestone' | 'empty';
}

/**
 * Format date for display
 */
function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d);
}

/**
 * Register Roboto font with jsPDF for Czech diacritics support
 */
function registerRobotoFont(doc: jsPDF): void {
  doc.addFileToVFS('Roboto-Regular.ttf', RobotoRegularBase64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
}

/**
 * Export schedule to XLSX format (simple list)
 */
export function exportScheduleToXLSX(
  rows: ScheduleRow[],
  projectTitle: string,
  rangeStart: Date,
  rangeEnd: Date,
  mode: 'realization' | 'tender'
): void {
  const workbook = XLSX.utils.book_new();

  const modeLabel = mode === 'realization' ? 'Realizace' : 'Výběrová řízení';

  // Header data
  const data: (string | number)[][] = [
    ['HARMONOGRAM - ' + modeLabel.toUpperCase()],
    [],
    ['Projekt:', projectTitle],
    ['Období:', `${formatDate(rangeStart)} – ${formatDate(rangeEnd)}`],
    ['Datum exportu:', formatDate(new Date())],
    [],
    ['Kategorie', 'Typ', 'Od', 'Do', 'Stav'],
  ];

  // Add rows
  for (const row of rows) {
    const startStr = row.start ? formatDate(row.start) : '—';
    const endStr = row.end ? formatDate(row.end) : '—';
    const status = row.kind === 'bar' ? 'Rozsah' : row.kind === 'milestone' ? 'Milník' : 'Bez termínu';

    data.push([
      row.label,
      row.subLabel || '—',
      startStr,
      endStr,
      status
    ]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  sheet['!cols'] = [
    { wch: 35 }, // Kategorie
    { wch: 15 }, // Typ
    { wch: 14 }, // Od
    { wch: 14 }, // Do
    { wch: 14 }, // Stav
  ];

  // Merge cells for title
  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, 'Harmonogram');

  // Download file
  const filename = `harmonogram_${projectTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

/**
 * Helper to get all months between two dates
 */
function getMonthsBetween(start: Date, end: Date): Date[] {
  const months: Date[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  
  while (current <= endMonth) {
    months.push(new Date(current));
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

/**
 * Helper to get all weeks (Monday start) between two dates
 */
function getWeeksBetween(start: Date, end: Date): Date[] {
  const weeks: Date[] = [];
  // Find the Monday of the start week
  const startDay = start.getDay();
  const delta = startDay === 0 ? -6 : 1 - startDay;
  const current = new Date(start);
  current.setDate(current.getDate() + delta);
  
  while (current <= end) {
    weeks.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}

/**
 * Convert a Date to a day index (days since epoch) for reliable comparison
 */
function toDayIndex(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / (24 * 60 * 60 * 1000));
}

/**
 * Generate array of all days between start and end dates
 */
function getDaysBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  while (current <= endDay) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

/**
 * Get Czech day abbreviation
 */
function getDayAbbr(d: Date): string {
  const dayNames = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
  return dayNames[d.getDay()];
}

/**
 * Export schedule to XLSX format with timeline/Gantt chart visualization.
 */
export async function exportScheduleWithTimelineToXLSX(
  rows: ScheduleRow[],
  projectTitle: string,
  rangeStart: Date,
  rangeEnd: Date,
  mode: 'realization' | 'tender',
  zoom: 'month' | 'week' | 'day' = 'month'
): Promise<void> {
  const workbook = XLSX.utils.book_new();
  const modeLabel = mode === 'realization' ? 'Realizace' : 'Výběrová řízení';
  const zoomLabel = zoom === 'day' ? 'denní' : zoom === 'week' ? 'týdenní' : 'měsíční';
  const isDayView = zoom === 'day';
  const isWeekView = zoom === 'week';

  const sheetName = isDayView ? 'Harmonogram (dny)' : isWeekView ? 'Harmonogram (týdny)' : 'Harmonogram (měsíce)';

  // Get time segments based on zoom level
  const days = isDayView ? getDaysBetween(rangeStart, rangeEnd) : [];
  const weeks = isWeekView ? getWeeksBetween(rangeStart, rangeEnd) : [];
  const months = (!isDayView && !isWeekView) ? getMonthsBetween(rangeStart, rangeEnd) : [];
  const numTimeCols = isDayView ? days.length : isWeekView ? weeks.length : months.length;

  const data: string[][] = [
    [`HARMONOGRAM S GRAFEM (${zoomLabel}) - ${modeLabel.toUpperCase()}`],
    [],
    ['Projekt:', projectTitle],
    ['Období:', `${formatDate(rangeStart)} – ${formatDate(rangeEnd)}`],
    ['Datum exportu:', formatDate(new Date())],
    [],
  ];

  const headerRow1Data: string[] = ['Kategorie', 'Typ', 'Od', 'Do'];
  if (isDayView) {
    const dateFormatter = new Intl.DateTimeFormat('cs-CZ', { day: '2-digit', month: '2-digit' });
    for (const day of days) {
      headerRow1Data.push(dateFormatter.format(day));
    }
  } else if (isWeekView) {
    const dateFormatter = new Intl.DateTimeFormat('cs-CZ', { day: '2-digit', month: '2-digit' });
    for (const week of weeks) {
      headerRow1Data.push(dateFormatter.format(week));
    }
  } else {
    const monthFormatter = new Intl.DateTimeFormat('cs-CZ', { month: 'short', year: '2-digit' });
    for (const month of months) {
      headerRow1Data.push(monthFormatter.format(month));
    }
  }
  data.push(headerRow1Data);

  if (isDayView) {
    const headerRow2Data: string[] = ['', '', '', ''];
    for (const day of days) {
      headerRow2Data.push(getDayAbbr(day));
    }
    data.push(headerRow2Data);
  }

  // Data rows
  for (const row of rows) {
    const startStr = row.start ? formatDate(row.start) : '—';
    const endStr = row.end ? formatDate(row.end) : '—';
    const rowData: string[] = [row.label, row.subLabel || '—', startStr, endStr];

    for (let i = 0; i < numTimeCols; i++) {
      let marker = '';

      if (row.kind === 'milestone' && row.start) {
        const milestoneDay = toDayIndex(row.start);
        if (isDayView) {
          marker = toDayIndex(days[i]) === milestoneDay ? '◆' : '';
        } else if (isWeekView) {
          const weekStartDay = toDayIndex(weeks[i]);
          marker = milestoneDay >= weekStartDay && milestoneDay <= weekStartDay + 6 ? '◆' : '';
        } else {
          const monthStart = new Date(months[i].getFullYear(), months[i].getMonth(), 1);
          const monthEnd = new Date(months[i].getFullYear(), months[i].getMonth() + 1, 0);
          marker = milestoneDay >= toDayIndex(monthStart) && milestoneDay <= toDayIndex(monthEnd) ? '◆' : '';
        }
      } else if (row.start && row.end) {
        const rowStartDay = toDayIndex(row.start);
        const rowEndDay = toDayIndex(row.end);

        if (isDayView) {
          const dayIndex = toDayIndex(days[i]);
          marker = dayIndex >= rowStartDay && dayIndex <= rowEndDay ? '■' : '';
        } else if (isWeekView) {
          const weekStartDay = toDayIndex(weeks[i]);
          const weekEndDay = weekStartDay + 6;
          const weekStartsInRange = weekStartDay >= rowStartDay && weekStartDay <= rowEndDay;
          const weekEndsInRange = weekEndDay >= rowStartDay && weekEndDay <= rowEndDay;
          const weekContainsRange = weekStartDay <= rowStartDay && weekEndDay >= rowEndDay;
          marker = weekStartsInRange || weekEndsInRange || weekContainsRange ? '■' : '';
        } else {
          const monthStart = new Date(months[i].getFullYear(), months[i].getMonth(), 1);
          const monthEnd = new Date(months[i].getFullYear(), months[i].getMonth() + 1, 0);
          const segmentStartDay = toDayIndex(monthStart);
          const segmentEndDay = toDayIndex(monthEnd);
          const segmentStartsInRange = segmentStartDay >= rowStartDay && segmentStartDay <= rowEndDay;
          const segmentEndsInRange = segmentEndDay >= rowStartDay && segmentEndDay <= rowEndDay;
          const segmentContainsRange = segmentStartDay <= rowStartDay && segmentEndDay >= rowEndDay;
          marker = segmentStartsInRange || segmentEndsInRange || segmentContainsRange ? '■' : '';
        }
      }

      rowData.push(marker);
    }

    data.push(rowData);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const colWidth = isDayView ? 5 : isWeekView ? 7 : 8;
  worksheet['!cols'] = [
    { wch: 35 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    ...Array.from({ length: numTimeCols }, () => ({ wch: colWidth })),
  ];
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.min(3 + numTimeCols, 19) } },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const zoomSuffix = isDayView ? '_dny' : isWeekView ? '_tydny' : '_mesice';
  const filename = `harmonogram_graf${zoomSuffix}_${projectTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}



/**
 * Export schedule to PDF format
 */
export function exportScheduleToPDF(
  rows: ScheduleRow[],
  projectTitle: string,
  rangeStart: Date,
  rangeEnd: Date,
  mode: 'realization' | 'tender'
): void {
  const doc = new jsPDF({ orientation: 'landscape' });

  // Register Roboto font for Czech diacritics support
  registerRobotoFont(doc);

  const modeLabel = mode === 'realization' ? 'Realizace' : 'Výběrová řízení';

  // Title
  doc.setFontSize(18);
  doc.setFont('Roboto', 'normal');
  doc.text(`Harmonogram - ${modeLabel}`, 14, 15);

  // Project info
  doc.setFontSize(10);
  doc.text(`Projekt: ${projectTitle}`, 14, 25);
  doc.text(`Období: ${formatDate(rangeStart)} – ${formatDate(rangeEnd)}`, 14, 31);
  doc.text(`Datum exportu: ${formatDate(new Date())}`, 14, 37);

  // Table data
  const tableData = rows.map((row) => {
    const startStr = row.start ? formatDate(row.start) : '—';
    const endStr = row.end ? formatDate(row.end) : '—';
    const status = row.kind === 'bar' ? 'Rozsah' : row.kind === 'milestone' ? 'Milník' : 'Bez termínu';

    return [
      row.label,
      row.subLabel || '—',
      startStr,
      endStr,
      status
    ];
  });

  autoTable(doc, {
    startY: 44,
    head: [['Kategorie', 'Typ', 'Od', 'Do', 'Stav']],
    body: tableData,
    styles: { fontSize: 9, cellPadding: 3, font: 'Roboto' },
    headStyles: { fillColor: [71, 85, 105], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 30 },
      2: { cellWidth: 30 },
      3: { cellWidth: 30 },
      4: { cellWidth: 30 },
    },
    margin: { left: 14, right: 14 }
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(
      `Exportováno: ${formatDate(new Date())} | Strana ${i} z ${pageCount}`,
      14,
      doc.internal.pageSize.height - 10
    );
  }

  // Download
  const filename = `harmonogram_${projectTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
