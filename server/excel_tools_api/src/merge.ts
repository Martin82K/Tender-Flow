import ExcelJS from "exceljs";
import { formatA1Range, parseA1Range } from "./a1";

const SKIP_SHEETS = new Set(["Rekapitulace stavby", "Pokyny pro vyplnění"]);

const HEADERS = [
  "List",
  "Výběrové řízení",
  "PČ",
  "Typ",
  "Kód",
  "Popis",
  "MJ",
  "Množství",
  "J.cena [CZK]",
  "Cena celkem [CZK]",
  "Cenová soustava",
] as const;

const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF366092" } } as const;
const HEADER_FONT = { bold: true, size: 11, color: { argb: "FFFFFFFF" } } as const;
const HEADER_ALIGNMENT = { horizontal: "center", vertical: "middle" } as const;

const SEP_FONT = { bold: true, size: 12, color: { argb: "FFFFFFFF" } } as const;
const SEP_ALIGNMENT = { horizontal: "center", vertical: "middle" } as const;

type MergeOptions = {
  skipSheets?: string[];
  sheetSeparatorFillArgb?: string; // e.g. FF366092
  headerFillArgb?: string; // e.g. FF366092
};

const getMerges = (ws: ExcelJS.Worksheet): string[] => {
  const model = ws.model as any;
  const merges = model?.merges;
  if (Array.isArray(merges)) return merges.filter((m) => typeof m === "string");
  if (merges && typeof merges === "object") return Object.keys(merges);

  const maybeMap = (ws as any)?._merges;
  if (maybeMap && typeof maybeMap.keys === "function") {
    return Array.from(maybeMap.keys()).filter((m) => typeof m === "string");
  }
  return [];
};

const safeMergeCells = (ws: ExcelJS.Worksheet, rangeA1: string) => {
  try {
    ws.mergeCells(rangeA1);
  } catch {
    // Ignore invalid/overlapping merges to avoid failing the whole merge run.
  }
};

const deepClone = <T,>(v: T): T => {
  // exceljs styles are plain objects most of the time, but some inputs can include
  // non-cloneable values; always fail open to avoid crashing the whole merge.
  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof (globalThis as any).structuredClone === "function") {
      return (globalThis as any).structuredClone(v);
    }
  } catch {
    // ignore
  }
  try {
    return JSON.parse(JSON.stringify(v)) as T;
  } catch {
    return { ...(v as any) } as T;
  }
};

export const mergeWorkbookToSingleSheet = async (input: Uint8Array, opts: MergeOptions = {}): Promise<Buffer> => {
  const inWb = new ExcelJS.Workbook();
  // exceljs typings use older Buffer definition; cast to avoid generic Buffer type mismatch in Node 22 types.
  await (inWb.xlsx as any).load(Buffer.from(input) as any);

  const outWb = new ExcelJS.Workbook();
  const outWs = outWb.addWorksheet("Kombinovane", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const skipSheets = new Set<string>([...SKIP_SHEETS, ...(opts.skipSheets ?? [])]);
  const headerFillArgb = opts.headerFillArgb ?? "FF366092";
  const sepFillArgb = opts.sheetSeparatorFillArgb ?? headerFillArgb;

  // Header row
  outWs.addRow([...HEADERS]);
  const headerRow = outWs.getRow(1);
  headerRow.height = 18;
  for (let c = 1; c <= HEADERS.length; c += 1) {
    const cell = headerRow.getCell(c);
    cell.fill = { ...(HEADER_FILL as any), fgColor: { argb: headerFillArgb } } as any;
    cell.font = HEADER_FONT as any;
    cell.alignment = HEADER_ALIGNMENT as any;
  }
  outWs.getColumn(1).width = 25;

  let outRow = 2;
  const maxSourceCols = HEADERS.length - 1; // A..J -> B..K
  const targetColWidths = new Map<number, number>();

  for (const ws of inWb.worksheets) {
    if (skipSheets.has(ws.name)) continue;
    if (ws.state === "hidden" || ws.state === "veryHidden") continue;

    // Prefer rowCount/columnCount to include styled-but-empty areas; cap columns to expected schema.
    const maxRows = ws.rowCount || ws.actualRowCount || 0;
    const maxCols = Math.min(ws.columnCount || ws.actualColumnCount || 0, maxSourceCols);
    if (maxRows <= 0 || maxCols <= 0) continue;

    // Separator row
    const sep = outWs.getRow(outRow);
    sep.getCell(1).value = `=== ${ws.name} ===`;
    sep.height = 20;
    for (let c = 1; c <= HEADERS.length; c += 1) {
      const cell = sep.getCell(c);
      cell.fill = { ...(HEADER_FILL as any), fgColor: { argb: sepFillArgb } } as any;
      cell.font = SEP_FONT as any;
      cell.alignment = SEP_ALIGNMENT as any;
    }
    outWs.mergeCells(outRow, 1, outRow, HEADERS.length);
    outRow += 1;

    const dataStartRow = outRow;

    // Copy cells row-by-row
    for (let r = 1; r <= maxRows; r += 1) {
      const srcRow = ws.getRow(r);
      const dstRow = outWs.getRow(dataStartRow + r - 1);
      if (srcRow.height != null) dstRow.height = srcRow.height;

      dstRow.getCell(1).value = ws.name;
      for (let c = 1; c <= maxCols; c += 1) {
        const srcCell = srcRow.getCell(c);
        const dstCell = dstRow.getCell(c + 1);
        dstCell.value = srcCell.value as any;
        dstCell.style = deepClone(srcCell.style);
      }
      dstRow.commit();
    }

    // Column widths
    for (let c = 1; c <= maxCols; c += 1) {
      const w = ws.getColumn(c).width;
      if (typeof w === "number" && w > 0) {
        const targetIdx = c + 1;
        const prev = targetColWidths.get(targetIdx) ?? 0;
        targetColWidths.set(targetIdx, Math.max(prev, w));
      }
    }

    // Merges
    for (const merge of getMerges(ws)) {
      try {
        const { s, e } = parseA1Range(merge);
        if (s.col > maxSourceCols) continue;
        const clippedECol = Math.min(e.col, maxSourceCols);
        if (clippedECol < s.col) continue;
        const shiftedS = { row: dataStartRow + s.row - 1, col: s.col + 1 };
        const shiftedE = { row: dataStartRow + e.row - 1, col: clippedECol + 1 };
        safeMergeCells(outWs, formatA1Range(shiftedS, shiftedE));
      } catch {
        // skip malformed merge ranges
      }
    }

    outRow = dataStartRow + maxRows + 1; // gap row
  }

  for (const [colIdx, width] of targetColWidths) {
    outWs.getColumn(colIdx).width = width;
  }

  // Autofilter
  const lastRow = Math.max(1, outWs.rowCount);
  outWs.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: lastRow, column: HEADERS.length },
  };

  const out = await (outWb.xlsx as any).writeBuffer();
  if (Buffer.isBuffer(out)) return out;
  // exceljs may return ArrayBuffer in some environments
  return Buffer.from(out as ArrayBuffer);
};

export type MergeExcelSheetsParams = {
  input: Uint8Array;
  skipSheets?: string[];
  headerFillArgb?: string;
  sheetSeparatorFillArgb?: string;
};

export const mergeExcelSheets = async (params: MergeExcelSheetsParams): Promise<Buffer> => {
  return await mergeWorkbookToSingleSheet(params.input, {
    skipSheets: params.skipSheets,
    headerFillArgb: params.headerFillArgb,
    sheetSeparatorFillArgb: params.sheetSeparatorFillArgb,
  });
};
