/**
 * Excel Merge - Supabase Edge Function
 * Merges multiple sheets from an Excel file into a single "Merged Data" sheet
 * Using ExcelJS (same as desktop version)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// We'll use ExcelJS via npm specifier (Deno supports npm:)
import ExcelJS from "npm:exceljs@4.4.0";

interface MergeRequest {
  sheets: string[]; // Sheet names to merge
}

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
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sheetsJson = formData.get("sheets") as string | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "Missing 'file' field" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!sheetsJson) {
      return new Response(
        JSON.stringify({ error: "Missing 'sheets' field" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const sheetsToInclude: string[] = JSON.parse(sheetsJson);

    if (!Array.isArray(sheetsToInclude) || sheetsToInclude.length === 0) {
      return new Response(
        JSON.stringify({ error: "No sheets selected for merging" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Load the Excel file
    const arrayBuffer = await file.arrayBuffer();
    const sourceWorkbook = new ExcelJS.Workbook();
    await sourceWorkbook.xlsx.load(arrayBuffer);

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

    // Return the merged Excel file
    const baseName = file.name.replace(/\.(xlsx|xlsm)$/i, "");
    const outputFilename = `${baseName}-merged.xlsx`;

    return new Response(outputBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${outputFilename}"`,
      },
    });
  } catch (error) {
    console.error("Error processing Excel merge:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
