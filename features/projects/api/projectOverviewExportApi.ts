import type { Workbook, Worksheet } from "exceljs";
import { TENDER_FLOW_LOGO_DATA_URL } from "@shared/branding/tenderFlowLogo";
import {
  buildDemandTableData,
  calculateOverviewFinancials,
  getWinningBids,
  getWinningBidTotal,
} from "@features/projects/model/projectOverviewNewModel";
import type { DemandCategory, ProjectDetails } from "@/types";
import type { OverviewDemandFilter } from "@features/projects/model/projectOverviewNewModel";
import type { ProjectOverviewVisibleColumns } from "@features/projects/model/useProjectOverviewNewController";

export interface ProjectOverviewExportOptions {
  demandFilter: OverviewDemandFilter;
  searchQuery: string;
  visibleColumns: ProjectOverviewVisibleColumns;
  exportedAt?: Date;
}

type ExportCell = string | number | null;
type ColumnKey = "status" | "title" | "price" | "supplier" | keyof ProjectOverviewVisibleColumns;
const MONEY_FORMAT = '#,##0.00 "Kč";[Red]-#,##0.00 "Kč";0.00 "Kč"';
const FILTER_LABELS: Record<OverviewDemandFilter, string> = {
  all: "Vše", open: "Poptávané", closed: "Ukončené", sod: "Zasmluvněné",
};
const STATUS_LABELS: Record<DemandCategory["status"], string> = {
  open: "Poptávka", negotiating: "Jednání", closed: "Uzavřeno", sod: "Smluvně",
};
const COLUMNS: { key: ColumnKey; label: string; width: number; money?: boolean }[] = [
  { key: "status", label: "Stav", width: 16 },
  { key: "title", label: "Poptávka", width: 38 },
  { key: "sod", label: "SOD", width: 23, money: true },
  { key: "plan", label: "Plán", width: 23, money: true },
  { key: "price", label: "Cena VŘ", width: 23, money: true },
  { key: "sod_vr", label: "SOD - VŘ", width: 23, money: true },
  { key: "pn_vr", label: "Plán - VŘ", width: 23, money: true },
  { key: "nabidky", label: "Nabídky", width: 13 },
  { key: "smlouvy", label: "Smlouvy", width: 13 },
  { key: "supplier", label: "Dodavatel", width: 42 },
];

// User-controlled text stays text, including after copying it into another spreadsheet.
const safeCell = (value: ExportCell): ExportCell => (
  typeof value === "string" && /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value
);

const categoryValues = (project: ProjectDetails, category: DemandCategory): Record<ColumnKey, ExportCell> => {
  const winners = getWinningBids(project, category.id);
  const price = getWinningBidTotal(project, category.id);
  const bids = project.bids?.[category.id] || [];
  return {
    status: STATUS_LABELS[category.status] || STATUS_LABELS.open,
    title: category.title,
    sod: category.sodBudget || 0,
    plan: category.planBudget || 0,
    price: winners.length ? price : null,
    sod_vr: winners.length ? (category.sodBudget || 0) - price : null,
    pn_vr: winners.length ? (category.planBudget || 0) - price : null,
    nabidky: `${bids.filter(bid => ["offer", "shortlist", "sod"].includes(bid.status)).length} / ${category.subcontractorCount || 0}`,
    smlouvy: winners.length ? `${winners.filter(bid => bid.contracted).length} / ${winners.length}` : null,
    supplier: winners.length ? winners.map(bid => bid.companyName).join(", ") : "Nepřiřazeno",
  };
};

const addHeader = (
  workbook: Workbook, sheet: Worksheet, project: ProjectDetails,
  options: ProjectOverviewExportOptions, exportedAt: Date, lastColumn: number,
) => {
  const logo = workbook.addImage({ base64: TENDER_FLOW_LOGO_DATA_URL, extension: "png" });
  sheet.addImage(logo, { tl: { col: 0.15, row: 0.1 }, ext: { width: 64, height: 64 }, editAs: "oneCell" });
  sheet.mergeCells(1, 2, 1, lastColumn);
  sheet.getCell(1, 2).value = "Přehled stavby";
  sheet.getCell(1, 2).font = { name: "Aptos Display", size: 22, bold: true, color: { argb: "FF1E293B" } };
  sheet.getCell(1, 2).alignment = { vertical: "middle" };
  sheet.getRow(1).height = 56;
  const lines = [
    `Stavba: ${project.title}`,
    `Zdroj: Tender Flow → ${project.title} → Přehled`,
    `Exportováno: ${exportedAt.toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })} (Europe/Prague)`,
    `Filtr poptávek: ${FILTER_LABELS[options.demandFilter]} · Hledání: ${options.searchQuery || "bez omezení"}`,
  ];
  lines.forEach((line, index) => {
    const row = index + 2;
    sheet.mergeCells(row, 1, row, lastColumn);
    sheet.getCell(row, 1).value = safeCell(line);
    sheet.getCell(row, 1).font = { name: "Aptos", size: 10, color: { argb: "FF475569" } };
    sheet.getCell(row, 1).alignment = { vertical: "middle", wrapText: true };
    const width = sheet.columns.reduce((sum, column) => sum + (column.width || 10), 0);
    sheet.getRow(row).height = Math.max(22, Math.ceil(line.length / (width * 0.8)) * 16);
  });
  sheet.headerFooter.oddFooter = "Tender Flow &C&P / &N";
};

const addSummarySection = (
  sheet: Worksheet, title: string, startRow: number, startCol: number,
  rows: readonly (readonly [string, ExportCell, string?])[],
) => {
  sheet.mergeCells(startRow, startCol, startRow, startCol + 1);
  const heading = sheet.getCell(startRow, startCol);
  heading.value = title;
  heading.font = { name: "Aptos", size: 11, bold: true, color: { argb: "FF334155" } };
  heading.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  sheet.getRow(startRow).height = 28;
  rows.forEach(([label, value, format], index) => {
    const row = startRow + index + 1;
    sheet.getCell(row, startCol).value = label;
    const cell = sheet.getCell(row, startCol + 1);
    cell.value = safeCell(value);
    if (format) cell.numFmt = format;
    for (const col of [startCol, startCol + 1]) {
      sheet.getCell(row, col).font = { name: "Aptos", size: 10, color: { argb: "FF334155" } };
      sheet.getCell(row, col).alignment = { vertical: "middle", wrapText: true };
    }
    const lineCount = Math.max(
      Math.ceil(label.length / (sheet.getColumn(startCol).width! * 0.8)),
      Math.ceil(String(value ?? "").length / (sheet.getColumn(startCol + 1).width! * 0.8)),
    );
    sheet.getRow(row).height = Math.max(sheet.getRow(row).height || 0, 28, lineCount * 16);
  });
};

export const buildProjectOverviewWorkbook = async (
  project: ProjectDetails,
  options: ProjectOverviewExportOptions,
): Promise<Workbook> => {
  const module = await import("exceljs");
  const ExcelJS = module.default ?? module;
  const workbook = new ExcelJS.Workbook();
  const exportedAt = options.exportedAt ?? new Date();
  workbook.creator = "Tender Flow";
  workbook.title = `Přehled stavby – ${project.title}`;
  workbook.created = exportedAt;
  workbook.modified = exportedAt;
  const createSheet = (name: string) => workbook.addWorksheet(name, {
    properties: { defaultRowHeight: 26 },
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const summary = createSheet("Přehled stavby");
  summary.columns = [29, 38, 29, 28].map(width => ({ width }));
  addHeader(workbook, summary, project, options, exportedAt, 4);
  summary.mergeCells("A6:D6");
  summary.getCell("A6").value = "Souhrn celé stavby (nezávisí na filtru poptávek).";
  const financials = calculateOverviewFinancials(project, project.plannedCost || 0);
  const invoices = project.investorFinancials?.invoices || [];
  addSummarySection(summary, "Údaje o stavbě", 8, 1, [
    ["Investor", project.investor || "-"], ["Lokace", project.location || "-"],
    ["Adresa", project.address || "-"], ["Termín", project.finishDate || "-"],
    ["Hl. stavbyvedoucí", project.siteManager || "-"],
    ...(project.status === "tender" ? [["Odevzdání nabídky", project.offerSubmissionDeadline || "-"] as const] : []),
  ]);
  addSummarySection(summary, "Finance (Investor)", 8, 3, [
    ["SOD cena", financials.investorSod, MONEY_FORMAT],
    ["Počet dodatků", project.investorFinancials?.amendments.length || 0],
    ["Dodatky celkem", financials.investorAmendmentsTotal, MONEY_FORMAT],
    ["Celkem investor", financials.totalBudget, MONEY_FORMAT],
    ["Fakturováno", invoices.reduce((sum, invoice) => sum + (invoice.amount || 0), 0), MONEY_FORMAT],
    ["Zaplaceno", invoices.filter(invoice => invoice.status === "paid").reduce((sum, invoice) => sum + (invoice.amount || 0), 0), MONEY_FORMAT],
  ]);
  addSummarySection(summary, "Interní rozpočet", 17, 1, [
    ["Plán (Cíl)", (project.plannedCost || 0) > 0 ? project.plannedCost! : null, MONEY_FORMAT],
    ["Počet dodatků", project.internalAmendments?.length || 0],
    ["Dodatky celkem", financials.internalAmendmentsTotal, MONEY_FORMAT],
    ["Plán včetně dodatků", financials.totalPlannedCost, MONEY_FORMAT],
    ["Zasmluvněno", financials.totalContractedCost, MONEY_FORMAT],
    ["Rezerva", financials.plannedBalance, MONEY_FORMAT],
  ]);
  addSummarySection(summary, "Parametry smlouvy", 17, 3, [
    ["Splatnost", project.contract?.maturity || 0, '0 "dní"'],
    ["Záruka", project.contract?.warranty || 0, '0 "měsíců"'],
    ["Pozastávka", project.contract?.retention || "-"],
    ["Zař. staveniště", project.contract?.siteFacilities || 0, '0.## " %"'],
    ["Pojištění", project.contract?.insurance || 0, '0.## " %"'],
  ]);
  summary.pageSetup.printArea = "A1:D23";

  const sheet = createSheet("Poptávky");
  const columns = COLUMNS.filter(column => !(column.key in options.visibleColumns)
    || options.visibleColumns[column.key as keyof ProjectOverviewVisibleColumns]);
  sheet.columns = columns.map(column => ({ width: column.width }));
  addHeader(workbook, sheet, project, options, exportedAt, columns.length);
  const { filteredCategories } = buildDemandTableData(project, options.demandFilter, options.searchQuery);
  const rows = [...filteredCategories].sort((a, b) => a.title.localeCompare(b.title, "cs"))
    .map(category => categoryValues(project, category));
  sheet.mergeCells(6, 1, 6, columns.length);
  sheet.getCell("A6").value = `Exportováno poptávek: ${rows.length} z ${project.categories.length}. Včetně řádků pod „Zobrazit více“.`;
  sheet.getCell("A6").alignment = { wrapText: true, vertical: "middle" };
  sheet.getRow(6).height = 30;
  sheet.getRow(8).values = columns.map(column => column.label);
  sheet.getRow(8).height = 30;
  sheet.getRow(8).eachCell(cell => {
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  rows.forEach((values, index) => {
    const row = sheet.getRow(9 + index);
    row.values = columns.map(column => safeCell(values[column.key]));
    row.height = Math.max(28, ...columns.map(column => Math.ceil(String(values[column.key] ?? "").length / (column.width * 0.8)) * 15));
    // Include empty prices and differences so the row band spans the full table.
    columns.forEach((_, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      cell.font = { name: "Aptos", size: 10, color: { argb: "FF334155" } };
      cell.alignment = { vertical: "middle", wrapText: true };
      if (index % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    });
  });
  const addTotals = (label: string, data: Record<ColumnKey, ExportCell>[], rowNumber: number) => {
    const row = sheet.getRow(rowNumber);
    row.values = columns.map(column => column.key === "title" ? label : column.money
      ? data.reduce((sum, values) => sum + (typeof values[column.key] === "number" ? values[column.key] as number : 0), 0) : null);
    row.height = 32;
    columns.forEach((_, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: "FF334155" } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      cell.border = { top: { style: "thin", color: { argb: "FF94A3B8" } } };
    });
  };
  addTotals("Součet exportovaných řádků", rows, rows.length + 9);
  if (rows.length !== project.categories.length) {
    addTotals("Celková bilance stavby", project.categories.map(category => categoryValues(project, category)), rows.length + 10);
  }
  columns.forEach((column, index) => { if (column.money) sheet.getColumn(index + 1).numFmt = MONEY_FORMAT; });
  sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 8, showGridLines: false }];
  sheet.autoFilter = { from: { row: 8, column: 1 }, to: { row: rows.length + 8, column: columns.length } };
  sheet.pageSetup.printTitlesRow = "8:8";
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(columns.length).letter}${sheet.rowCount}`;
  return workbook;
};

export const exportProjectOverviewToXlsx = async (
  project: ProjectDetails,
  options: ProjectOverviewExportOptions,
): Promise<void> => {
  const exportedAt = options.exportedAt ?? new Date();
  const workbook = await buildProjectOverviewWorkbook(project, { ...options, exportedAt });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const name = project.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100) || "stavba";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = `prehled_${name}_${exportedAt.toISOString().replace(/[:.]/g, "-")}.xlsx`;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Keep the URL alive briefly so the browser/desktop download can consume it.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
};
