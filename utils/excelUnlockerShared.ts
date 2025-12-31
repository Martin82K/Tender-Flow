import * as XLSX from "xlsx";

export const unlockWorkbook = (workbook: XLSX.WorkBook): void => {
  if (!workbook?.SheetNames?.length) return;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets?.[sheetName] as any;
    if (!sheet) continue;
    if (sheet["!protect"]) {
      delete sheet["!protect"];
    }
  }

  // Best-effort cleanup for workbook-level sheet metadata protection flags (if present).
  const wbAny = workbook as any;
  const sheetsMeta: any[] | undefined = wbAny?.Workbook?.Sheets;
  if (Array.isArray(sheetsMeta)) {
    for (const meta of sheetsMeta) {
      if (!meta || typeof meta !== "object") continue;
      if (meta.Protect !== undefined) delete meta.Protect;
      if (meta.protect !== undefined) delete meta.protect;
    }
  }
};

