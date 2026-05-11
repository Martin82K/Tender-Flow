/**
 * Excel Merge - Supabase Edge Function
 * Merges multiple sheets from an Excel file into a single "Merged Data" sheet
 * Using ExcelJS (same as desktop version)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { createAuthedUserClient } from "../_shared/supabase.ts";

// We'll use ExcelJS via npm specifier (Deno supports npm:)
import ExcelJS from "npm:exceljs@4.4.0";

interface MergeRequest {
  sheets: string[]; // Sheet names to merge
}

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_OUTPUT_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_SHEET_SELECTION = 50;
const MAX_WORKSHEETS = 50;
const MAX_ROWS_PER_WORKSHEET = 100_000;
const MAX_COLUMNS_PER_WORKSHEET = 256;
const MAX_CELLS = 500_000;
const MAX_SHEET_NAME_LENGTH = 128;
const MAX_FORMULA_LENGTH = 8_192;
const DANGEROUS_FORMULA_PATTERN =
  /\b(?:WEBSERVICE|HYPERLINK|RTD|CALL|REGISTER\.ID)\s*\(|\[[^\]]+\]|(?:https?|ftp):\/\/|\\\\|(?:cmd|powershell|mshta|wscript|cscript)\s*\|/i;

/**
 * Helper to shift column letters (e.g., A -> B, Z -> AA)
 */
function shiftColumn(colName: string, shift: number): string {
  let colIdx = 0;
  const cleanCol = colName.replace(/\$/g, "");
  for (let i = 0; i < cleanCol.length; i++) {
    colIdx = colIdx * 26 + (cleanCol.charCodeAt(i) - 64);
  }
  colIdx += shift;

  let newColName = "";
  while (colIdx > 0) {
    const rem = (colIdx - 1) % 26;
    newColName = String.fromCharCode(65 + rem) + newColName;
    colIdx = Math.floor((colIdx - rem) / 26);
  }
  return (colName.startsWith("$") ? "$" : "") + newColName;
}

/**
 * Adjusts formula string to account for column and row shifts.
 */
function transformFormula(
  formula: string,
  colShift: number,
  rowShift: number,
  sheetsInFile: string[]
): string {
  if (!formula) return "";

  let cleanedFormula = formula;
  sheetsInFile.forEach((name) => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`'?${escapedName}'?!`, "g");
    cleanedFormula = cleanedFormula.replace(regex, "");
  });

  return cleanedFormula.replace(
    /(\$?[A-Z]{1,3})(\$?[0-9]+)/g,
    (match, col, row) => {
      if (match.length > 10) return match;
      const isAbsoluteRow = row.startsWith("$");
      const newCol = shiftColumn(col, colShift);

      let newRow = row;
      if (!isAbsoluteRow) {
        newRow = (parseInt(row) + rowShift).toString();
      } else {
        const rowNum = parseInt(row.substring(1));
        if (rowNum > 2) {
          newRow = "$" + (rowNum + rowShift).toString();
        }
      }
      return newCol + newRow;
    }
  );
}

function isFormulaSafeToPreserve(formula: string): boolean {
  const normalized = formula.trim();
  return (
    normalized.length > 0 &&
    normalized.length <= MAX_FORMULA_LENGTH &&
    !DANGEROUS_FORMULA_PATTERN.test(normalized)
  );
}

function validateWorkbookShape(workbook: ExcelJS.Workbook): void {
  if (workbook.worksheets.length > MAX_WORKSHEETS) {
    throw new Error(`Workbook has too many worksheets (max ${MAX_WORKSHEETS})`);
  }

  let totalCells = 0;
  for (const worksheet of workbook.worksheets) {
    const rowCount = worksheet.rowCount || worksheet.actualRowCount || 0;
    const columnCount = worksheet.columnCount || worksheet.actualColumnCount || 0;

    if (rowCount > MAX_ROWS_PER_WORKSHEET) {
      throw new Error(`Worksheet "${worksheet.name}" has too many rows`);
    }

    if (columnCount > MAX_COLUMNS_PER_WORKSHEET) {
      throw new Error(`Worksheet "${worksheet.name}" has too many columns`);
    }

    totalCells += rowCount * Math.max(1, columnCount);
    if (totalCells > MAX_CELLS) {
      throw new Error(`Workbook has too many cells (max ${MAX_CELLS})`);
    }
  }
}

function sanitizeDownloadFilename(name: string, suffix: string): string {
  const lastSegment = name.split(/[\\/]/).pop() || "workbook.xlsx";
  const baseName = lastSegment.replace(/\.xlsx$/i, "");
  const normalized = baseName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[_ .-]+|[_ .-]+$/g, "")
    .slice(0, 80);
  return `${normalized || "workbook"}${suffix}`;
}

/**
 * Copy cell style from source to destination
 */
function copyCellStyle(srcCell: ExcelJS.Cell, destCell: ExcelJS.Cell): void {
  if (srcCell.style) {
    destCell.style = JSON.parse(JSON.stringify(srcCell.style));
  }
  if (srcCell.numFmt) {
    destCell.numFmt = srcCell.numFmt;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
        status: 401,
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sheetsJson = formData.get("sheets") as string | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "Missing 'file' field" }),
        {
          status: 400,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    if (!sheetsJson) {
      return new Response(
        JSON.stringify({ error: "Missing 'sheets' field" }),
        {
          status: 400,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return new Response(
        JSON.stringify({ error: "Only .xlsx files are supported" }),
        {
          status: 400,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return new Response(
        JSON.stringify({ error: "File too large (max 10 MB)" }),
        {
          status: 413,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    const sheetsToInclude: string[] = JSON.parse(sheetsJson);

    if (
      !Array.isArray(sheetsToInclude) ||
      sheetsToInclude.length === 0 ||
      sheetsToInclude.length > MAX_SHEET_SELECTION ||
      !sheetsToInclude.every((name) => typeof name === "string" && name.length > 0 && name.length <= MAX_SHEET_NAME_LENGTH)
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid sheet selection" }),
        {
          status: 400,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    // Load the Excel file
    const arrayBuffer = await file.arrayBuffer();
    const sourceWorkbook = new ExcelJS.Workbook();
    await sourceWorkbook.xlsx.load(arrayBuffer);
    validateWorkbookShape(sourceWorkbook);

    const allSheetNames = sourceWorkbook.worksheets.map((ws: ExcelJS.Worksheet) => ws.name);

    // Create target workbook
    const targetWorkbook = new ExcelJS.Workbook();
    const targetSheet = targetWorkbook.addWorksheet("Merged Data");

    // Apply view settings (freeze header row, show gridlines)
    targetSheet.views = [
      {
        state: "frozen",
        xSplit: 0,
        ySplit: 1,
        showGridLines: true,
        activeCell: "A2",
      },
    ];

    let currentRow = 1;
    let maxColsOverall = 0;

    // Process each selected sheet
    for (let i = 0; i < sheetsToInclude.length; i++) {
      const sheetName = sheetsToInclude[i];
      const sourceSheet = sourceWorkbook.getWorksheet(sheetName);

      if (!sourceSheet) {
        console.warn(`Sheet "${sheetName}" not found, skipping.`);
        continue;
      }

      let sheetMaxCol = 0;
      sourceSheet.eachRow({ includeEmpty: true }, (row: ExcelJS.Row) => {
        sheetMaxCol = Math.max(
          sheetMaxCol,
          row.actualCellCount || 0,
          row.cellCount || 0
        );
      });
      maxColsOverall = Math.max(maxColsOverall, sheetMaxCol);

      // Add separator row between sheets (except for the first one)
      if (i > 0) {
        const separatorRow = targetSheet.getRow(currentRow);
        separatorRow.height = 20;
        const separatorCell = separatorRow.getCell(1);
        separatorCell.value = ` LIST: ${sheetName.toUpperCase()} `;
        separatorCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1E40AF" },
        };
        separatorCell.font = { color: { argb: "FFFFFFFF" }, bold: true, size: 9 };
        separatorCell.alignment = { vertical: "middle", horizontal: "center" };

        try {
          targetSheet.mergeCells(
            currentRow,
            1,
            currentRow,
            Math.max(13, sheetMaxCol + 1)
          );
        } catch (_e) {
          // Ignore merge errors
        }
        currentRow++;
      }

      // Copy rows from source sheet
      sourceSheet.eachRow({ includeEmpty: true }, (row: ExcelJS.Row) => {
        const targetRow = targetSheet.getRow(currentRow);
        if (row.height) targetRow.height = row.height;

        // Column 1: Source Sheet Name (metadata)
        const sourceNameCell = targetRow.getCell(1);
        sourceNameCell.value = row.number <= 1 ? "" : sheetName;
        sourceNameCell.font = { size: 8, color: { argb: "FF94A3B8" } };

        const rowShift = currentRow - row.number;
        const colShift = 1;

        const lastCol = Math.max(row.actualCellCount || 0, row.cellCount || 0);

        for (let c = 1; c <= lastCol; c++) {
          const cell = row.getCell(c);
          const destCell = targetRow.getCell(c + 1);

          if (cell.type === ExcelJS.ValueType.Formula) {
            const fValue = cell.value as ExcelJS.CellFormulaValue;
            try {
              if (!isFormulaSafeToPreserve(fValue.formula || "")) {
                destCell.value = fValue.result ?? null;
                copyCellStyle(cell, destCell);
                continue;
              }

              const newFormula = transformFormula(
                fValue.formula,
                colShift,
                rowShift,
                allSheetNames
              );
              destCell.value = {
                formula: newFormula,
                result: fValue.result,
              };
            } catch (_e) {
              destCell.value = fValue.result;
            }
          } else {
            destCell.value = cell.value;
          }
          copyCellStyle(cell, destCell);
        }
        currentRow++;
      });

      currentRow++; // Spacing between sheets
    }

    // Apply autofilter
    targetSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, currentRow - 2), column: Math.max(13, maxColsOverall + 1) },
    };

    // Set column widths
    targetSheet.getColumn(1).width = 15;
    const firstSheet = sourceWorkbook.getWorksheet(sheetsToInclude[0]);
    if (firstSheet) {
      firstSheet.columns.forEach((col: ExcelJS.Column, idx: number) => {
        if (col && col.width) {
          targetSheet.getColumn(idx + 2).width = col.width;
        }
      });
    }

    // Generate output buffer
    const outputBuffer = await targetWorkbook.xlsx.writeBuffer();
    if (outputBuffer.byteLength > MAX_OUTPUT_SIZE_BYTES) {
      return new Response(
        JSON.stringify({ error: "Merged workbook too large" }),
        {
          status: 413,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    // Return the merged Excel file
    const outputFilename = sanitizeDownloadFilename(file.name, "-merged.xlsx");

    return new Response(outputBuffer, {
      status: 200,
      headers: {
        ...buildCorsHeaders(req),
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${outputFilename}"; filename*=UTF-8''${encodeURIComponent(outputFilename)}`,
      },
    });
  } catch (error) {
    console.error("Error processing Excel merge:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
