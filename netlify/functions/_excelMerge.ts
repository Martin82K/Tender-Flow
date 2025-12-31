import ExcelJS from "exceljs";

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

const parseA1 = (addr: string): { row: number; col: number } => {
  const m = /^([A-Za-z]+)(\d+)$/.exec(addr.trim());
  if (!m) throw new Error(`Invalid A1 address: ${addr}`);
  const letters = m[1].toUpperCase();
  let col = 0;
  for (const ch of letters) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: Number(m[2]) };
};

const formatA1 = ({ row, col }: { row: number; col: number }): string => {
  let n = col;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return `${s}${row}`;
};

const parseA1Range = (range: string): { s: { row: number; col: number }; e: { row: number; col: number } } => {
  const parts = range.split(":");
  if (parts.length !== 2) throw new Error(`Invalid A1 range: ${range}`);
  const a = parseA1(parts[0]);
  const b = parseA1(parts[1]);
  return {
    s: { row: Math.min(a.row, b.row), col: Math.min(a.col, b.col) },
    e: { row: Math.max(a.row, b.row), col: Math.max(a.col, b.col) },
  };
};

const formatA1Range = (s: { row: number; col: number }, e: { row: number; col: number }): string =>
  `${formatA1(s)}:${formatA1(e)}`;

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
    // ignore overlapping / invalid merges
  }
};

const deepClone = <T,>(v: T): T => {
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

export const mergeWorkbookToSingleSheet = async (input: Uint8Array): Promise<Buffer> => {
  const inWb = new ExcelJS.Workbook();
  await (inWb.xlsx as any).load(Buffer.from(input) as any);

  const outWb = new ExcelJS.Workbook();
  const outWs = outWb.addWorksheet("Kombinovane", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Header row
  outWs.addRow([...HEADERS]);
  const headerRow = outWs.getRow(1);
  headerRow.height = 18;
  for (let c = 1; c <= HEADERS.length; c += 1) {
    const cell = headerRow.getCell(c);
    cell.fill = HEADER_FILL as any;
    cell.font = HEADER_FONT as any;
    cell.alignment = HEADER_ALIGNMENT as any;
  }
  outWs.getColumn(1).width = 25;

  let outRow = 2;
  const maxSourceCols = HEADERS.length - 1; // A..J -> B..K
  const targetColWidths = new Map<number, number>();

  for (const ws of inWb.worksheets) {
    if (SKIP_SHEETS.has(ws.name)) continue;
    if (ws.state === "hidden" || ws.state === "veryHidden") continue;

    const maxRows = ws.rowCount || ws.actualRowCount || 0;
    const maxCols = Math.min(ws.columnCount || ws.actualColumnCount || 0, maxSourceCols);
    if (maxRows <= 0 || maxCols <= 0) continue;

    // Separator row
    const sep = outWs.getRow(outRow);
    sep.getCell(1).value = `=== ${ws.name} ===`;
    sep.height = 20;
    for (let c = 1; c <= HEADERS.length; c += 1) {
      const cell = sep.getCell(c);
      cell.fill = HEADER_FILL as any;
      cell.font = SEP_FONT as any;
      cell.alignment = SEP_ALIGNMENT as any;
    }
    outWs.mergeCells(outRow, 1, outRow, HEADERS.length);
    outRow += 1;

    const dataStartRow = outRow;

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
        // ignore malformed merges
      }
    }

    outRow = dataStartRow + maxRows + 1; // gap row
  }

  for (const [colIdx, width] of targetColWidths) {
    outWs.getColumn(colIdx).width = width;
  }

  outWs.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, outWs.rowCount), column: HEADERS.length },
  };

  const out = await (outWb.xlsx as any).writeBuffer();
  if (Buffer.isBuffer(out)) return out;
  return Buffer.from(out as ArrayBuffer);
};

