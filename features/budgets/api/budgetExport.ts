import * as XLSX from "xlsx";
import type { DemandCategory, ProjectDetails } from "@/types";
import { getDocHubTenderLinks, isProbablyUrl, joinDocHubPath } from "@/shared/dochub/docHub";
import type { ProjectBudget } from "../model/budgetTypes";
import { filterBudgetByTender } from "../model/budgetSummary";
import { formatBudgetCurrency, sanitizeBudgetFileSegment } from "../model/budgetFormat";

export type BudgetTenderExportResult =
  | { mode: "download"; filename: string }
  | { mode: "desktop"; filename: string; path: string };

const todayIso = () => new Date().toISOString().split("T")[0];

export const buildBudgetTenderExportFilename = (tenderTitle: string, date = todayIso()): string =>
  `rozpocet_vr_${sanitizeBudgetFileSegment(tenderTitle)}_${date}.xlsx`;

export const buildBudgetExportFilename = (projectTitle: string, date = todayIso()): string =>
  `rozpocet_${sanitizeBudgetFileSegment(projectTitle)}_${date}.xlsx`;

const buildTenderBudgetWorkbook = (
  budget: ProjectBudget,
  project: ProjectDetails,
  tender: DemandCategory,
) => {
  const workbook = XLSX.utils.book_new();
  const rows: Array<Array<string | number>> = [
    ["ROZPOČET VÝBĚROVÉHO ŘÍZENÍ"],
    ["Projekt", project.title],
    ["Výběrové řízení", tender.title],
    ["Datum exportu", new Date().toLocaleDateString("cs-CZ")],
    ["Celkem bez DPH", budget.totalPrice],
    ["Celkem s DPH", budget.totalPriceWithVat],
    [],
    [
      "Objekt",
      "Kapitola",
      "P.č.",
      "Kód",
      "Název položky",
      "MJ",
      "Množství",
      "Jednotková cena",
      "Celkem bez DPH",
      "DPH %",
      "Celkem s DPH",
      "Výkaz výměr",
    ],
  ];

  budget.sheets.forEach((sheet) => {
    sheet.categories.forEach((category) => {
      category.items.forEach((item) => {
        rows.push([
          sheet.name,
          category.name,
          item.positionLabel || "",
          item.code || "",
          item.name,
          item.unit,
          item.amount,
          item.unitPrice,
          item.totalPrice,
          item.vatRate,
          item.totalPriceWithVat,
          item.measurements
            .map((measurement) =>
              [measurement.note, measurement.formula, measurement.result].filter(Boolean).join(" | "),
            )
            .join("\n"),
        ]);
      });
    });
  });

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 18 },
    { wch: 28 },
    { wch: 10 },
    { wch: 16 },
    { wch: 48 },
    { wch: 8 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 8 },
    { wch: 16 },
    { wch: 40 },
  ];
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];
  XLSX.utils.book_append_sheet(workbook, sheet, "Rozpočet VŘ");

  const summaryRows: Array<Array<string | number>> = [
    ["Souhrn"],
    ["Celkem bez DPH", formatBudgetCurrency(budget.totalPrice)],
    ["Celkem s DPH", formatBudgetCurrency(budget.totalPriceWithVat)],
    [],
    ["Objekt", "Kapitola", "Počet položek", "Celkem bez DPH", "Celkem s DPH"],
  ];
  budget.sheets.forEach((sheet) => {
    sheet.categories.forEach((category) => {
      summaryRows.push([
        sheet.name,
        category.name,
        category.items.length,
        category.items.reduce((sum, item) => sum + item.totalPrice, 0),
        category.items.reduce((sum, item) => sum + item.totalPriceWithVat, 0),
      ]);
    });
  });
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 24 }, { wch: 32 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Souhrn");

  return workbook;
};

const buildFullBudgetWorkbook = (budget: ProjectBudget, project: ProjectDetails) => {
  const workbook = XLSX.utils.book_new();

  const coverRows: Array<Array<string | number>> = [
    ["ROZPOČET STAVBY"],
    ["Projekt", project.title],
    ["Datum exportu", new Date().toLocaleDateString("cs-CZ")],
    ["Celkem bez DPH", budget.totalPrice],
    ["Celkem s DPH", budget.totalPriceWithVat],
    [],
    ["Objekt", "Počet položek", "Celkem bez DPH", "Celkem s DPH"],
  ];

  budget.sheets.forEach((sheet) => {
    const itemCount = sheet.categories.reduce((sum, category) => sum + category.items.length, 0);
    coverRows.push([sheet.name, itemCount, sheet.totalPrice, sheet.totalPriceWithVat]);
  });

  const coverSheet = XLSX.utils.aoa_to_sheet(coverRows);
  coverSheet["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 18 }];
  coverSheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  XLSX.utils.book_append_sheet(workbook, coverSheet, "Souhrn");

  budget.sheets.forEach((budgetSheet, sheetIndex) => {
    const rows: Array<Array<string | number>> = [
      [budgetSheet.name],
      ["Kapitola", "P.č.", "Kód", "Název položky", "MJ", "Množství", "Jednotková cena", "Celkem bez DPH", "DPH %", "Celkem s DPH", "Výkaz výměr"],
    ];

    budgetSheet.categories.forEach((category) => {
      rows.push([category.name, "", "", "", "", "", "", category.totalPrice, "", category.totalPriceWithVat, ""]);
      category.items.forEach((item) => {
        rows.push([
          category.name,
          item.positionLabel || "",
          item.code || "",
          item.name,
          item.unit,
          item.amount,
          item.unitPrice,
          item.totalPrice,
          item.vatRate,
          item.totalPriceWithVat,
          item.measurements
            .map((measurement) =>
              [measurement.note, measurement.formula, measurement.result].filter(Boolean).join(" | "),
            )
            .join("\n"),
        ]);
      });
    });

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 28 },
      { wch: 10 },
      { wch: 16 },
      { wch: 48 },
      { wch: 8 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 8 },
      { wch: 16 },
      { wch: 40 },
    ];
    sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];
    XLSX.utils.book_append_sheet(
      workbook,
      sheet,
      sanitizeBudgetFileSegment(budgetSheet.name).slice(0, 31) || `SO ${sheetIndex + 1}`,
    );
  });

  return workbook;
};

const downloadWorkbook = (workbook: XLSX.WorkBook, filename: string) => {
  XLSX.writeFile(workbook, filename);
};

const workbookToBytes = (workbook: XLSX.WorkBook): Uint8Array => {
  const array = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Uint8Array(array);
};

const getLocalTenderFolderPath = (project: ProjectDetails, tender: DemandCategory): string | null => {
  if (!project.docHubEnabled || !project.docHubRootLink || project.docHubProvider !== "local") return null;
  if (isProbablyUrl(project.docHubRootLink)) return null;
  const links = getDocHubTenderLinks(project.docHubRootLink, tender.title, project.docHubStructureV1);
  return links.tenderBase;
};

export const exportBudgetTenderToXlsx = async (input: {
  budget: ProjectBudget;
  project: ProjectDetails;
  tender: DemandCategory;
  preferDesktopFolder?: boolean;
}): Promise<BudgetTenderExportResult> => {
  const filteredBudget = filterBudgetByTender(input.budget, input.tender.id);
  if (!filteredBudget) {
    throw new Error("Výběrové řízení nemá přiřazené žádné rozpočtové položky.");
  }

  const filename = buildBudgetTenderExportFilename(input.tender.title);
  const workbook = buildTenderBudgetWorkbook(filteredBudget, input.project, input.tender);
  const tenderFolderPath = input.preferDesktopFolder
    ? getLocalTenderFolderPath(input.project, input.tender)
    : null;
  const electronFs = (window as any).electronAPI?.fs;

  if (tenderFolderPath && electronFs?.writeFile) {
    const filePath = joinDocHubPath(tenderFolderPath, filename);
    await electronFs.writeFile(filePath, workbookToBytes(workbook) as any);
    return { mode: "desktop", filename, path: filePath };
  }

  downloadWorkbook(workbook, filename);
  return { mode: "download", filename };
};

export const exportBudgetToXlsx = async (input: {
  budget: ProjectBudget;
  project: ProjectDetails;
  preferDesktopFolder?: boolean;
}): Promise<BudgetTenderExportResult> => {
  const filename = buildBudgetExportFilename(input.project.title);
  const workbook = buildFullBudgetWorkbook(input.budget, input.project);
  const electronFs = (window as any).electronAPI?.fs;

  if (
    input.preferDesktopFolder
    && input.project.docHubEnabled
    && input.project.docHubProvider === "local"
    && input.project.docHubRootLink
    && !isProbablyUrl(input.project.docHubRootLink)
    && electronFs?.writeFile
  ) {
    const filePath = joinDocHubPath(input.project.docHubRootLink, filename);
    await electronFs.writeFile(filePath, workbookToBytes(workbook) as any);
    return { mode: "desktop", filename, path: filePath };
  }

  downloadWorkbook(workbook, filename);
  return { mode: "download", filename };
};
