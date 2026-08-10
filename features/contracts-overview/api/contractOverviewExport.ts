import type { ContractOverviewRow } from "./contractOverviewApi";
import {
  CONTRACT_OVERVIEW_PARAMETER_LABELS,
  getContractOverviewStatusLabel,
  type ContractOverviewParameterKey,
} from "../model/contractOverviewModel";

type ContractOverviewExportCell = string | number | Date | null;

export interface ContractOverviewExportMeta {
  organizationName: string;
  exportedBy: string;
  exportedAt?: Date;
  appVersion: string;
  appLogoDataUrl?: string | null;
}

const DEFAULT_TF_LOGO_URL = "/TF_ico.png";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const loadExcelJS = async () => {
  const module = await import("exceljs");
  return module.default ?? module;
};

const safeCell = (value: ContractOverviewExportCell): ContractOverviewExportCell => {
  if (typeof value !== "string") return value;
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
};

const parseExportDate = (value: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parameterValue = (
  row: ContractOverviewRow,
  key: ContractOverviewParameterKey,
): ContractOverviewExportCell => {
  switch (key) {
    case "warranty": return row.warrantyMonths;
    case "warrantyEnd": return parseExportDate(row.warrantyEnd);
    case "retentionShort": return row.retentionShortPercent;
    case "retentionShortRelease": return parseExportDate(row.retentionShortReleaseOn);
    case "retentionLong": return row.retentionLongPercent;
    case "retentionLongRelease": return parseExportDate(row.retentionLongReleaseOn);
    case "warrantyRetention": return row.warrantyRetentionPercent;
    case "warrantyRetentionRelease": return parseExportDate(row.warrantyRetentionReleaseOn);
    case "maturity": return row.maturityDays;
    case "paymentTerms": return row.paymentTerms || "";
  }
};

export const buildContractOverviewExportRows = (
  rows: ContractOverviewRow[],
  visibleParameters: ContractOverviewParameterKey[],
): ContractOverviewExportCell[][] => {
  const header = [
    "Typ řádku", "Stavba", "Partner", "Smlouva", "Dokument smlouvy", "Stav",
    "Limit / aktuální hodnota", "Čerpání", "Zbývá", "Hodnota dodatku",
    ...visibleParameters.map((key) => CONTRACT_OVERVIEW_PARAMETER_LABELS[key]),
  ];
  const output: ContractOverviewExportCell[][] = [header];

  for (const row of rows) {
    output.push([
      "Smlouva",
      safeCell(row.projectName),
      safeCell(row.contractPartner),
      safeCell([row.contractTitle, row.contractNumber].filter(Boolean).join(" · ")),
      safeCell(row.documentFileName || (row.documentUrl || row.documentStoragePath ? "Připojený dokument" : "")),
      safeCell(getContractOverviewStatusLabel(row.contractStatus)),
      row.currentTotal,
      row.approvedDrawdown,
      row.remainingAmount,
      null,
      ...visibleParameters.map((key) => safeCell(parameterValue(row, key))),
    ]);

    for (const amendment of row.amendments) {
      output.push([
        "Dodatek",
        safeCell(row.projectName),
        safeCell(row.contractPartner),
        safeCell(`Dodatek č. ${amendment.amendmentNo}`),
        safeCell(amendment.documentFileName || (amendment.documentUrl || amendment.documentStoragePath ? "Připojený dokument" : "")),
        safeCell(amendment.status ? getContractOverviewStatusLabel(amendment.status) : ""),
        null,
        null,
        null,
        amendment.deltaPrice,
        ...visibleParameters.map(() => null),
      ]);
    }
  }
  return output;
};

const fetchImageDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const normalizeCurrency = (currency: string): string => {
  const normalized = currency.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "CZK";
};

const currencyNumberFormat = (currency: string): string => {
  const symbol = currency === "CZK" ? "Kč" : currency === "EUR" ? "€" : currency === "USD" ? "$" : currency;
  return `#,##0.00 "${symbol}"`;
};

const parameterColumnWidth = (key: ContractOverviewParameterKey): number => {
  switch (key) {
    case "warrantyEnd":
    case "retentionShortRelease":
    case "retentionLongRelease":
    case "warrantyRetentionRelease":
      return 16;
    case "paymentTerms":
      return 24;
    default:
      return 18;
  }
};

const isDateParameter = (key: ContractOverviewParameterKey): boolean => (
  key === "warrantyEnd"
  || key === "retentionShortRelease"
  || key === "retentionLongRelease"
  || key === "warrantyRetentionRelease"
);

const isPercentParameter = (key: ContractOverviewParameterKey): boolean => (
  key === "retentionShort"
  || key === "retentionLong"
  || key === "warrantyRetention"
);

export const buildContractOverviewWorkbook = async (
  rows: ContractOverviewRow[],
  visibleParameters: ContractOverviewParameterKey[],
  meta: ContractOverviewExportMeta,
) => {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const exportedAt = meta.exportedAt ?? new Date();
  const exportRows = buildContractOverviewExportRows(rows, visibleParameters);
  const totalColumns = exportRows[0].length;
  const sheet = workbook.addWorksheet("Smluvní přehled", {
    views: [{ state: "frozen", xSplit: 3, ySplit: 9, topLeftCell: "D10" }],
    properties: { defaultRowHeight: 20 },
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  workbook.creator = "Tender Flow";
  workbook.company = meta.organizationName;
  workbook.title = "Smluvní přehled";
  workbook.subject = "Export globálního smluvního přehledu";
  workbook.created = exportedAt;
  workbook.modified = exportedAt;

  sheet.views = [{ state: "frozen", xSplit: 3, ySplit: 9, topLeftCell: "D10", showGridLines: false }];
  sheet.headerFooter.oddFooter = `Tender Flow ${meta.appVersion} &C&F &RStrana &P z &N`;
  sheet.columns = [
    14, 28, 26, 34, 24, 14, 20, 17, 17, 18,
    ...visibleParameters.map(parameterColumnWidth),
  ].map((width) => ({ width }));
  [1, 2, 3, 4, 5, 6].forEach((column) => {
    sheet.getColumn(column).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  });

  if (meta.appLogoDataUrl) {
    const imageId = workbook.addImage({ base64: meta.appLogoDataUrl, extension: "png" });
    sheet.addImage(imageId, {
      tl: { col: 0.25, row: 0.25 },
      ext: { width: 70, height: 70 },
      editAs: "oneCell",
    });
  }

  sheet.mergeCells(1, 3, 1, totalColumns);
  sheet.getCell("C1").value = "Smluvní přehled";
  sheet.getCell("C1").font = { name: "Aptos Display", size: 22, bold: true, color: { argb: "FF0F172A" } };
  sheet.getCell("C1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 30;

  sheet.mergeCells(2, 3, 2, totalColumns);
  sheet.getCell("C2").value = `${meta.organizationName || "Organizace"} · Všechny oprávněné stavby`;
  sheet.getCell("C2").font = { name: "Aptos", size: 12, bold: true, color: { argb: "FF334155" } };
  sheet.getCell("C2").alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells(3, 3, 3, totalColumns);
  sheet.getCell("C3").value = `Export provedl: ${meta.exportedBy || "Uživatel"}`;
  sheet.getCell("C3").font = { name: "Aptos", size: 10, color: { argb: "FF475569" } };
  sheet.getCell("C3").alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells(4, 3, 4, totalColumns);
  sheet.getCell("C4").value = `Datum exportu: ${exportedAt.toLocaleString("cs-CZ")} · Tender Flow ${meta.appVersion}`;
  sheet.getCell("C4").font = { name: "Aptos", size: 10, color: { argb: "FF64748B" } };
  sheet.getCell("C4").alignment = { horizontal: "center", vertical: "middle" };

  const cardLabels = ["POČET SMLUV", "HODNOTA SMLUV", "ČERPÁNÍ", "ZBÝVÁ"];
  const cardValues = [
    rows.length,
    rows.reduce((sum, row) => sum + row.currentTotal, 0),
    rows.reduce((sum, row) => sum + row.approvedDrawdown, 0),
    rows.reduce((sum, row) => sum + row.remainingAmount, 0),
  ];
  const currencies = new Set(rows.map((row) => normalizeCurrency(row.currency)));
  const summaryCurrency = currencies.size === 1 ? [...currencies][0] : null;
  for (let index = 0; index < 4; index += 1) {
    const startColumn = Math.floor(index * totalColumns / 4) + 1;
    const endColumn = index === 3 ? totalColumns : Math.floor((index + 1) * totalColumns / 4);
    sheet.mergeCells(6, startColumn, 6, endColumn);
    sheet.mergeCells(7, startColumn, 7, endColumn);
    const labelCell = sheet.getCell(6, startColumn);
    labelCell.value = cardLabels[index];
    labelCell.font = { name: "Aptos", size: 9, bold: true, color: { argb: "FF64748B" } };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    const valueCell = sheet.getCell(7, startColumn);
    valueCell.value = cardValues[index];
    valueCell.font = { name: "Aptos Display", size: 15, bold: true, color: { argb: index === 0 ? "FF0F172A" : "FFEA580C" } };
    valueCell.alignment = { horizontal: "center", vertical: "middle" };
    valueCell.numFmt = index === 0 ? "#,##0" : summaryCurrency ? currencyNumberFormat(summaryCurrency) : "#,##0.00";
  }

  const table = sheet.addTable({
    name: "ContractOverviewTable",
    ref: "A9",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: exportRows[0].map((name) => ({ name: String(name) })),
    rows: exportRows.slice(1),
  });
  table.commit();

  const lastRow = Math.max(9, 8 + exportRows.length);
  const lastColumnLetter = sheet.getColumn(totalColumns).letter;
  sheet.autoFilter = { from: "A9", to: `${lastColumnLetter}${lastRow}` };
  sheet.getRow(9).height = 30;
  sheet.getRow(9).eachCell((cell) => {
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      right: { style: "thin", color: { argb: "FF475569" } },
      bottom: { style: "medium", color: { argb: "FFEA580C" } },
    };
  });

  const rowCurrencies = rows.flatMap((row) => [
    normalizeCurrency(row.currency),
    ...row.amendments.map(() => normalizeCurrency(row.currency)),
  ]);
  for (let rowNumber = 10; rowNumber <= lastRow; rowNumber += 1) {
    const sourceRow = exportRows[rowNumber - 9];
    const isAmendment = sourceRow[0] === "Dodatek";
    const dataRow = sheet.getRow(rowNumber);
    dataRow.height = isAmendment ? 26 : 34;
    dataRow.eachCell((cell) => {
      cell.font = { name: "Aptos", size: 10, color: { argb: "FF1E293B" } };
      cell.alignment = { vertical: "middle" };
      cell.border = { bottom: { style: "thin", color: { argb: "FFCBD5E1" } } };
      if (isAmendment) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    });
    const currency = rowCurrencies[rowNumber - 10] || "CZK";
    [7, 8, 9, 10].forEach((column) => {
      const cell = sheet.getCell(rowNumber, column);
      if (typeof cell.value === "number") cell.numFmt = currencyNumberFormat(currency);
      cell.alignment = { horizontal: "right", vertical: "middle" };
    });
    visibleParameters.forEach((key, parameterIndex) => {
      const cell = sheet.getCell(rowNumber, 11 + parameterIndex);
      if (cell.value instanceof Date && isDateParameter(key)) cell.numFmt = "dd.mm.yyyy";
      if (typeof cell.value === "number" && isPercentParameter(key)) cell.numFmt = "0.00\" %\"";
      if (typeof cell.value === "number" && key === "warranty") cell.numFmt = "0 \"měs.\"";
      if (typeof cell.value === "number" && key === "maturity") cell.numFmt = "0 \"dní\"";
      cell.alignment = {
        horizontal: key === "paymentTerms" ? "left" : "center",
        vertical: "middle",
        wrapText: key === "paymentTerms",
      };
    });
  }

  sheet.pageSetup.printArea = `A1:${lastColumnLetter}${lastRow}`;
  return workbook;
};

export const exportContractOverviewToExcel = async (
  rows: ContractOverviewRow[],
  visibleParameters: ContractOverviewParameterKey[],
  meta: ContractOverviewExportMeta,
): Promise<void> => {
  const appLogoDataUrl = meta.appLogoDataUrl === undefined
    ? await fetchImageDataUrl(DEFAULT_TF_LOGO_URL)
    : meta.appLogoDataUrl;
  const workbook = await buildContractOverviewWorkbook(rows, visibleParameters, {
    ...meta,
    appLogoDataUrl,
  });
  const output = await workbook.xlsx.writeBuffer();
  const blob = new Blob([output as BlobPart], { type: XLSX_MIME });
  downloadBlob(blob, `smluvni_prehled_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
