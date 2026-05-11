import * as XLSX from "xlsx";
import type { TenderPlanItem } from "@/types";

const formatDate = (dateString: string): string => {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateString));
};

const parseExcelDate = (value: unknown): string => {
  if (!value) return "";

  if (typeof value === "number") {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return date.toISOString().split("T")[0];
  }

  if (typeof value === "string") {
    const czechDate = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (czechDate) {
      return `${czechDate[3]}-${czechDate[2].padStart(2, "0")}-${czechDate[1].padStart(2, "0")}`;
    }

    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }

  return "";
};

export const exportTenderPlanToXLSX = (items: TenderPlanItem[], projectTitle: string): void => {
  const workbook = XLSX.utils.book_new();
  const data: (string | number)[][] = [
    ["PLÁN VÝBĚROVÝCH ŘÍZENÍ", "", "", "", ""],
    ["Projekt:", projectTitle, "", "", ""],
    ["Datum exportu:", formatDate(new Date().toISOString()), "", "", ""],
    [],
    ["Název VŘ", "Od (plán)", "Do (plán)", "Stav", "ID Poptávky"],
  ];

  items.forEach((item) => {
    data.push([
      item.name,
      item.dateFrom ? formatDate(item.dateFrom) : "-",
      item.dateTo ? formatDate(item.dateTo) : "-",
      item.categoryId ? "Vytvořeno" : "Naplánováno",
      item.categoryId || "-",
    ]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = [
    { wch: 40 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 20 },
  ];
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

  XLSX.utils.book_append_sheet(workbook, sheet, "Plán VŘ");

  const filename = `plan_vr_${projectTitle.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

export const downloadTenderImportTemplate = (): void => {
  const workbook = XLSX.utils.book_new();
  const data = [
    ["Název poptávky", "Popis", "SOD Rozpočet", "Plánovaný náklad", "Termín (Deadline)", "Zahájení realizace", "Konec realizace"],
    ["Příklad: Obklady koupelny", "Detailní popis prací...", "150000", "120000", "2024-12-31", "2025-01-15", "2025-02-28"],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = [
    { wch: 40 },
    { wch: 50 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, "Šablona importu");
  XLSX.writeFile(workbook, "sablona_import_poptavky.xlsx");
};

export const importTenderPlanFromXLSX = async (file: File): Promise<Partial<TenderPlanItem>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

        if (rows.length < 2) {
          resolve([]);
          return;
        }

        let headerRowIndex = 0;
        const colMap: Partial<Record<"name" | "from" | "to", number>> = {};

        for (let rowIndex = 0; rowIndex < Math.min(rows.length, 10); rowIndex++) {
          const row = rows[rowIndex];
          const rowText = row.map((cell) => String(cell).toLowerCase()).join(" ");

          if (
            rowText.includes("název") ||
            rowText.includes("name") ||
            rowText.includes("description") ||
            rowText.includes("popis")
          ) {
            headerRowIndex = rowIndex;
            row.forEach((cell, cellIndex) => {
              const normalized = String(cell).toLowerCase().trim();
              if (
                normalized.includes("název") ||
                normalized.includes("name") ||
                normalized.includes("popis") ||
                normalized.includes("položka")
              ) {
                colMap.name = cellIndex;
              } else if (normalized.includes("od") || normalized.includes("start") || normalized.includes("zahájení")) {
                colMap.from = cellIndex;
              } else if (
                normalized.includes("do") ||
                normalized.includes("end") ||
                normalized.includes("konec") ||
                normalized.includes("termín")
              ) {
                colMap.to = cellIndex;
              }
            });
            break;
          }
        }

        if (colMap.name === undefined) {
          colMap.name = 0;
          colMap.from = 5;
          colMap.to = 6;
        }

        const items: Partial<TenderPlanItem>[] = [];

        for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
          const row = rows[rowIndex];
          if (!row || row.length === 0) continue;

          const name = row[colMap.name];
          if (!name) continue;

          const dateFrom = colMap.from !== undefined ? parseExcelDate(row[colMap.from]) : "";
          const dateTo = colMap.to !== undefined ? parseExcelDate(row[colMap.to]) : "";
          const finalDateTo = dateTo || parseExcelDate(row[4]);

          items.push({
            name: String(name).trim(),
            dateFrom,
            dateTo: finalDateTo,
          });
        }

        resolve(items);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
};
