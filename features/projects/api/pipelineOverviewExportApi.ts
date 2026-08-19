import { TENDER_FLOW_LOGO_DATA_URL } from "@/shared/branding/tenderFlowLogo";
import { parseDecimal } from "@/shared/formatting/decimalFormatters";
import { formatMoney } from "@/shared/formatting/numberFormatters";
import { loadPdfRuntime, registerRobotoFont } from "@/shared/pdf/pdfRuntime";
import type { Bid, DemandCategory, ProjectStatus } from "@/types";

type TenderOverviewExportCell = string | number | Date | null;

export interface TenderOverviewExportMeta {
  organizationName: string;
  projectTitle: string;
  projectStatus: ProjectStatus;
  exportedBy: string;
  exportedAt?: Date;
  appVersion: string;
  appLogoDataUrl?: string | null;
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const loadExcelJS = async () => {
  const module = await import("exceljs");
  return module.default ?? module;
};

const hasBidPrice = (bid: Bid): boolean => {
  const selectedRoundPrice = bid.selectionRound == null
    ? undefined
    : bid.priceHistory?.[bid.selectionRound];
  const price = bid.price && bid.price !== "?" && bid.price !== "-"
    ? bid.price
    : selectedRoundPrice;
  return typeof price === "string" && price.trim() !== "" && parseDecimal(price) !== null;
};

const bidPrice = (bid: Bid): number | null => {
  const selectedRoundPrice = bid.selectionRound == null
    ? undefined
    : bid.priceHistory?.[bid.selectionRound];
  const price = bid.price && bid.price !== "?" && bid.price !== "-"
    ? bid.price
    : selectedRoundPrice;
  if (!price) return null;
  return parseDecimal(price);
};

const safeCell = (value: TenderOverviewExportCell): TenderOverviewExportCell => {
  if (typeof value !== "string") return value;
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
};

const projectTypeLabel = (status: ProjectStatus): string => (
  status === "tender" ? "Soutěž" : status === "archived" ? "Archiv" : "Realizace"
);

const categoryStatusLabel = (status: DemandCategory["status"]): string => {
  switch (status) {
    case "closed": return "Uzavřeno";
    case "sod": return "V realizaci";
    case "negotiating": return "Vyjednávání";
    default: return "Poptávání";
  }
};

export const getTenderBidStatusLabel = (bid: Bid): string => {
  if (bid.status === "rejected") return "Zamítnut / odstoupil";
  if (bid.status === "sod") return bid.contracted ? "Zasmluvněn" : "Jednání o SOD";
  if (bid.status === "shortlist") return "Užší výběr";
  if (hasBidPrice(bid) || bid.status === "offer") {
    return "Dodal cenu";
  }
  if (bid.status === "sent") return "Nedodal cenu";
  return "Poptán";
};

const TENDER_BID_STATUS_ORDER: Record<string, number> = {
  "Zasmluvněn": 0,
  "Jednání o SOD": 1,
  "Užší výběr": 2,
  "Dodal cenu": 3,
  "Nedodal cenu": 4,
  "Poptán": 5,
  "Zamítnut / odstoupil": 6,
};

export const sortTenderBidsByStatus = (bids: readonly Bid[]): Bid[] => (
  [...bids].sort((left, right) => {
    const leftStatus = getTenderBidStatusLabel(left);
    const rightStatus = getTenderBidStatusLabel(right);
    const statusDifference = (TENDER_BID_STATUS_ORDER[leftStatus] ?? 99)
      - (TENDER_BID_STATUS_ORDER[rightStatus] ?? 99);
    return statusDifference || left.companyName.localeCompare(right.companyName, "cs");
  })
);

const realizationRange = (category: DemandCategory): string => {
  if (!category.realizationStart && !category.realizationEnd) return "";
  const start = category.realizationStart
    ? new Date(category.realizationStart).toLocaleDateString("cs-CZ")
    : "?";
  const end = category.realizationEnd
    ? new Date(category.realizationEnd).toLocaleDateString("cs-CZ")
    : "?";
  return `${start} – ${end}`;
};

const bidContact = (bid: Bid): string => (
  [bid.contactPerson, bid.email, bid.phone].filter(Boolean).join(" · ")
);

export const buildTenderOverviewExportRows = (
  categories: DemandCategory[],
  bidsByCategory: Record<string, Bid[]>,
): TenderOverviewExportCell[][] => {
  const output: TenderOverviewExportCell[][] = [[
    "Typ řádku",
    "Stav",
    "VŘ / dodavatel",
    "Termín / aktualizace",
    "Realizace / kontakt",
    "Cena",
    "Poptáno",
    "CN",
    "Smlouvy",
    "Popis / poznámka",
  ]];

  for (const category of categories) {
    const categoryBids = bidsByCategory[category.id] || [];
    const offeredBids = categoryBids.filter(hasBidPrice);
    const sodBids = categoryBids.filter((bid) => bid.status === "sod");
    const contractedCount = sodBids.filter((bid) => bid.contracted).length;
    const winningPrice = sodBids.reduce((sum, bid) => sum + (bidPrice(bid) || 0), 0);

    output.push([
      "Výběrové řízení",
      categoryStatusLabel(category.status),
      category.title,
      category.deadline ? new Date(category.deadline) : null,
      realizationRange(category),
      winningPrice || category.sodBudget || null,
      categoryBids.length,
      offeredBids.length,
      sodBids.length > 0 ? `${contractedCount}/${sodBids.length}` : "",
      category.description || "",
    ]);

    for (const bid of sortTenderBidsByStatus(categoryBids)) {
      output.push([
        "Dodavatel",
        getTenderBidStatusLabel(bid),
        bid.companyName,
        bid.updateDate ? new Date(bid.updateDate) : null,
        bidContact(bid),
        bidPrice(bid),
        "Ano",
        hasBidPrice(bid) ? "Ano" : "Ne",
        bid.contracted ? "Ano" : bid.status === "sod" ? "Čeká" : "",
        bid.notes || "",
      ]);
    }
  }

  return output;
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

const safeFilename = (value: string): string => (
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase() || "projekt"
);

export const buildTenderOverviewWorkbook = async (
  categories: DemandCategory[],
  bidsByCategory: Record<string, Bid[]>,
  meta: TenderOverviewExportMeta,
) => {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const exportedAt = meta.exportedAt ?? new Date();
  const exportRows = buildTenderOverviewExportRows(categories, bidsByCategory);
  const sheet = workbook.addWorksheet("Výběrová řízení", {
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
  workbook.title = `Přehled výběrových řízení – ${meta.projectTitle}`;
  workbook.subject = "Export výběrových řízení a poptaných dodavatelů";
  workbook.created = exportedAt;
  workbook.modified = exportedAt;

  sheet.views = [{ state: "frozen", xSplit: 3, ySplit: 9, topLeftCell: "D10", showGridLines: false }];
  sheet.headerFooter.oddFooter = `Tender Flow ${meta.appVersion} &C&F &RStrana &P z &N`;
  sheet.columns = [18, 24, 32, 20, 38, 18, 12, 12, 14, 38].map((width) => ({ width }));

  const appLogoDataUrl = meta.appLogoDataUrl === undefined
    ? TENDER_FLOW_LOGO_DATA_URL
    : meta.appLogoDataUrl;
  if (appLogoDataUrl) {
    const imageId = workbook.addImage({ base64: appLogoDataUrl, extension: "png" });
    sheet.addImage(imageId, {
      tl: { col: 0.25, row: 0.25 },
      ext: { width: 70, height: 70 },
      editAs: "oneCell",
    });
  }

  sheet.mergeCells("C1:J1");
  sheet.getCell("C1").value = "Přehled výběrových řízení";
  sheet.getCell("C1").font = { name: "Aptos Display", size: 22, bold: true, color: { argb: "FF0F172A" } };
  sheet.getCell("C1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 30;

  sheet.mergeCells("C2:J2");
  sheet.getCell("C2").value = `${meta.organizationName || "Organizace"} · ${meta.projectTitle || "Projekt"} · ${projectTypeLabel(meta.projectStatus)}`;
  sheet.getCell("C2").font = { name: "Aptos", size: 12, bold: true, color: { argb: "FF334155" } };
  sheet.getCell("C2").alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells("C3:J3");
  sheet.getCell("C3").value = `Export provedl: ${meta.exportedBy || "Uživatel"}`;
  sheet.getCell("C3").font = { name: "Aptos", size: 10, color: { argb: "FF475569" } };
  sheet.getCell("C3").alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells("C4:J4");
  sheet.getCell("C4").value = `Datum exportu: ${exportedAt.toLocaleString("cs-CZ")} · Tender Flow ${meta.appVersion}`;
  sheet.getCell("C4").font = { name: "Aptos", size: 10, color: { argb: "FF64748B" } };
  sheet.getCell("C4").alignment = { horizontal: "center", vertical: "middle" };

  const allBids = categories.flatMap((category) => bidsByCategory[category.id] || []);
  const cards = [
    ["POČET VŘ", categories.length],
    ["POPTANÍ DODAVATELÉ", allBids.length],
    ["DODANÉ CENY", allBids.filter(hasBidPrice).length],
    ["ODSTOUPILI / ZAMÍTNUTI", allBids.filter((bid) => bid.status === "rejected").length],
  ] as const;
  const cardRanges = [[1, 2], [3, 5], [6, 7], [8, 10]] as const;
  cards.forEach(([label, value], index) => {
    const [from, to] = cardRanges[index];
    sheet.mergeCells(6, from, 6, to);
    sheet.mergeCells(7, from, 7, to);
    const labelCell = sheet.getCell(6, from);
    labelCell.value = label;
    labelCell.font = { name: "Aptos", size: 9, bold: true, color: { argb: "FF64748B" } };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    const valueCell = sheet.getCell(7, from);
    valueCell.value = value;
    valueCell.font = { name: "Aptos Display", size: 15, bold: true, color: { argb: index === 3 ? "FFDC2626" : "FF0F172A" } };
    valueCell.alignment = { horizontal: "center", vertical: "middle" };
  });

  const table = sheet.addTable({
    name: "TenderOverviewTable",
    ref: "A9",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: false },
    columns: exportRows[0].map((name) => ({ name: String(name) })),
    rows: exportRows.slice(1).map((row) => row.map(safeCell)),
  });
  table.commit();

  sheet.getRow(9).height = 30;
  sheet.getRow(9).eachCell((cell) => {
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      right: { style: "thin", color: { argb: "FF475569" } },
      bottom: { style: "medium", color: { argb: "FFEA580C" } },
    };
  });

  const lastRow = 8 + exportRows.length;
  for (let rowNumber = 10; rowNumber <= lastRow; rowNumber += 1) {
    const isSupplier = exportRows[rowNumber - 9][0] === "Dodavatel";
    const row = sheet.getRow(rowNumber);
    row.height = isSupplier ? 28 : 34;
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.font = {
        name: "Aptos",
        size: 10,
        bold: !isSupplier && (column === 1 || column === 3),
        color: { argb: "FF1E293B" },
      };
      cell.alignment = {
        horizontal: column === 6 || (column >= 7 && column <= 9) ? "right" : "left",
        vertical: "middle",
        wrapText: column === 3 || column === 5 || column === 10,
        indent: isSupplier && column === 3 ? 1 : 0,
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isSupplier ? "FFE8F4F8" : "FFFFFFFF" },
      };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFD8E0EA" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
        ...(column === 1 ? { left: { style: "thin", color: { argb: "FFE2E8F0" } } } : {}),
      };
    });
    const priceCell = sheet.getCell(rowNumber, 6);
    if (typeof priceCell.value === "number") priceCell.numFmt = '#,##0.00 "Kč"';
    [4].forEach((column) => {
      const dateCell = sheet.getCell(rowNumber, column);
      if (dateCell.value instanceof Date) dateCell.numFmt = "dd.mm.yyyy";
    });
  }
  sheet.pageSetup.printArea = `A1:J${lastRow}`;
  return workbook;
};

export const exportTenderOverviewToXlsx = async (
  categories: DemandCategory[],
  bidsByCategory: Record<string, Bid[]>,
  meta: TenderOverviewExportMeta,
): Promise<void> => {
  const workbook = await buildTenderOverviewWorkbook(categories, bidsByCategory, meta);
  const output = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([output as BlobPart], { type: XLSX_MIME }),
    `prehled_vr_${safeFilename(meta.projectTitle)}_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
};

export const exportTenderOverviewToPdf = async (
  categories: DemandCategory[],
  bidsByCategory: Record<string, Bid[]>,
  meta: TenderOverviewExportMeta,
): Promise<void> => {
  const { RobotoRegularBase64, autoTable, jsPDF } = await loadPdfRuntime();
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  registerRobotoFont(doc, RobotoRegularBase64);
  doc.setFont("Roboto", "normal");
  const exportedAt = meta.exportedAt ?? new Date();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const rows = buildTenderOverviewExportRows(categories, bidsByCategory);
  const appLogoDataUrl = meta.appLogoDataUrl === undefined
    ? TENDER_FLOW_LOGO_DATA_URL
    : meta.appLogoDataUrl;

  if (appLogoDataUrl) {
    try {
      doc.addImage(appLogoDataUrl, "PNG", 14, 8, 20, 12);
    } catch {
      // Export zůstane použitelný i při poškozeném nebo nepodporovaném logu.
    }
  }

  doc.setFont("Roboto", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text("Přehled výběrových řízení", appLogoDataUrl ? 39 : 14, 16);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const metadataText = `${meta.organizationName || "Organizace"} · ${meta.projectTitle || "Projekt"} · ${projectTypeLabel(meta.projectStatus)}`;
  const wrappedMetadata = doc.splitTextToSize(metadataText, pageWidth - 28);
  const metadataLines = Array.isArray(wrappedMetadata)
    ? wrappedMetadata.map(String)
    : [String(wrappedMetadata)];
  const metadataBottomY = 25 + Math.max(0, metadataLines.length - 1) * 4;
  const auditLineY = metadataBottomY + 6;
  const tableStartY = auditLineY + 7;
  doc.text(metadataLines.length === 1 ? metadataLines[0] : metadataLines, 14, 25);
  doc.text(`Export provedl: ${meta.exportedBy || "Uživatel"}`, 14, auditLineY);
  doc.text(`Datum exportu: ${exportedAt.toLocaleString("cs-CZ")} · Tender Flow ${meta.appVersion}`, pageWidth - 14, auditLineY, { align: "right" });

  autoTable(doc, {
    startY: tableStartY,
    head: [rows[0].map(String)],
    body: rows.slice(1).map((row) => row.map((cell, column) => {
      if (cell instanceof Date) return cell.toLocaleDateString("cs-CZ");
      if (typeof cell === "number" && column === 5) return formatMoney(cell);
      return cell == null ? "" : String(cell);
    })),
    styles: { font: "Roboto", fontSize: 7, cellPadding: 2, textColor: [15, 23, 42], valign: "middle" },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 29 },
      2: { cellWidth: 40 },
      3: { cellWidth: 24 },
      4: { cellWidth: 44 },
      5: { cellWidth: 24, halign: "right" },
      6: { cellWidth: 14, halign: "right" },
      7: { cellWidth: 12, halign: "right" },
      8: { cellWidth: 16, halign: "right" },
      9: { cellWidth: 44 },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const isSupplier = rows[data.row.index + 1]?.[0] === "Dodavatel";
      if (isSupplier) data.cell.styles.fillColor = [232, 244, 248];
      else data.cell.styles.fontStyle = "bold";
    },
    margin: { left: 14, right: 14, bottom: 14 },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Tender Flow ${meta.appVersion}`, 14, pageHeight - 7);
    doc.text(`Strana ${page} z ${pages}`, pageWidth - 14, pageHeight - 7, { align: "right" });
  }

  doc.save(`prehled_vr_${safeFilename(meta.projectTitle)}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
