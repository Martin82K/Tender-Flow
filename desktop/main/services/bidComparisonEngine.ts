import ExcelJS from 'exceljs';

export type HeaderColumnKey =
  | 'pc'
  | 'typ'
  | 'kod'
  | 'popis'
  | 'mj'
  | 'mnozstvi'
  | 'jcena'
  | 'celkem';

export interface HeaderColumnMap {
  pc?: number;
  typ?: number;
  kod?: number;
  popis?: number;
  mj?: number;
  mnozstvi?: number;
  jcena?: number;
  celkem?: number;
}

export interface BidComparisonItem {
  pc: string | null;
  kod: string | null;
  jcena: number | null;
  celkem: number | null;
  radek: number;
}

export interface ParsedSheetResult {
  items: BidComparisonItem[];
  headerRow: number;
  columnMap: HeaderColumnMap;
  kRows: number[];
}

export interface DetectionAnalysis {
  headerRow: number | null;
  kRows: number;
  pricedKRows: number;
  columnMap: HeaderColumnMap;
  isValidTemplate: boolean;
}

export interface BidOfferInput {
  supplierName: string;
  displayLabel: string;
  filePath: string;
  round: number;
  variant: number;
}

export interface BuildComparisonInput {
  zadaniPath: string;
  offers: BidOfferInput[];
  onProgress?: (percent: number, step: string) => void;
  isCancelled?: () => boolean;
}

export interface BuildComparisonResult {
  outputBuffer: Buffer;
  pocetPolozek: number;
  suppliers: Record<
    string,
    {
      sparovano: number;
      nesparovano: string[];
      round: number;
      variant: number;
    }
  >;
}

const HEADER_SYNONYMS: Record<HeaderColumnKey, string[]> = {
  pc: ['pč', 'pc', 'p.č.', 'p.č', 'cenový kód', 'cenovy kod'],
  typ: ['typ'],
  kod: ['kód', 'kod', 'code'],
  popis: ['popis', 'description', 'název položky'],
  mj: ['mj', 'm.j.', 'měrná jednotka', 'jednotka'],
  mnozstvi: ['množství', 'mnozstvi', 'mn.', 'qty'],
  jcena: ['j.cena', 'jcena', 'j. cena', 'jednotková cena', 'jedn. cena'],
  celkem: ['cena celkem', 'celkem', 'cena', 'total'],
};

const PALETTE = [
  { header: 'D6E4F0', total: 'BDD7EE', fontColor: '1F4E79' },
  { header: 'FCE4D6', total: 'F8CBAD', fontColor: '833C0B' },
  { header: 'E2EFDA', total: 'C6EFCE', fontColor: '375623' },
  { header: 'E4DFEC', total: 'D0C5E6', fontColor: '4A2882' },
  { header: 'FFF2CC', total: 'FFE699', fontColor: '806000' },
  { header: 'F2DCDB', total: 'E6B8B7', fontColor: '8B0000' },
];

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' },
  bottom: { style: 'thin' },
};

const NUMBER_FORMAT = '#,##0.00';

const toArgb = (hex: string): string => {
  const clean = hex.trim().replace('#', '').toUpperCase();
  return clean.length === 8 ? clean : `FF${clean}`;
};

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\[czk\]|\(czk\)|czk/g, '')
    .trim();

const readCellText = (value: ExcelJS.CellValue): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('formula' in value) return `=${value.formula}`;
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text || '').join('');
    }
    if ('text' in value) return String(value.text ?? '');
    if ('result' in value) return readCellText(value.result as ExcelJS.CellValue);
  }
  return String(value);
};

export const safeNumericValue = (value: ExcelJS.CellValue): number | null => {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw || raw.startsWith('=')) return null;
    const normalized = raw.replace(/\s+/g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === 'object') {
    // Pokud je v buňce vzorec, cenu nebereme (dle požadavku ignorovat vzorce).
    if ('formula' in value) return null;
    if ('result' in value && typeof value.result === 'number' && Number.isFinite(value.result)) {
      return value.result;
    }
    if ('text' in value) {
      return safeNumericValue(String(value.text ?? ''));
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      const joined = value.richText.map((part) => part.text || '').join('');
      return safeNumericValue(joined);
    }
  }

  return null;
};

export const findHeaderRow = (worksheet: ExcelJS.Worksheet, maxRows = 20): number | null => {
  const limit = Math.min(maxRows, worksheet.rowCount);
  for (let rowIndex = 1; rowIndex <= limit; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const values: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      values.push(normalizeText(readCellText(cell.value)));
    });
    const line = values.join(' | ');
    const hasCore = line.includes('pč') || line.includes('pc') || line.includes('kód') || line.includes('kod');
    if (hasCore) {
      return rowIndex;
    }
  }
  return null;
};

export const findColumns = (worksheet: ExcelJS.Worksheet, headerRow: number): HeaderColumnMap => {
  const map: HeaderColumnMap = {};
  for (let column = 1; column <= worksheet.columnCount; column += 1) {
    const header = normalizeText(readCellText(worksheet.getRow(headerRow).getCell(column).value));
    if (!header) continue;

    (Object.keys(HEADER_SYNONYMS) as HeaderColumnKey[]).forEach((key) => {
      if (map[key]) return;
      const match = HEADER_SYNONYMS[key].some((synonym) => header === synonym || header.startsWith(synonym));
      if (match) map[key] = column;
    });
  }
  return map;
};

const parseWorksheet = (worksheet: ExcelJS.Worksheet): ParsedSheetResult => {
  const headerRow = findHeaderRow(worksheet);
  if (!headerRow) {
    throw new Error(`Nelze najít řádek hlavičky v listu "${worksheet.name}".`);
  }

  const columnMap = findColumns(worksheet, headerRow);
  const typCol = columnMap.typ;
  const pcCol = columnMap.pc;
  const kodCol = columnMap.kod;
  const jcCol = columnMap.jcena;
  const celCol = columnMap.celkem;

  if (!typCol || (!kodCol && !pcCol)) {
    throw new Error(`V listu "${worksheet.name}" chybí povinné sloupce (Typ + Kód/PČ).`);
  }

  const items: BidComparisonItem[] = [];
  const kRows: number[] = [];

  for (let rowIndex = headerRow + 1; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const typRaw = normalizeText(readCellText(row.getCell(typCol).value)).toUpperCase();
    if (typRaw !== 'K') continue;

    kRows.push(rowIndex);
    const pcValue = pcCol ? readCellText(row.getCell(pcCol).value).trim() : '';
    const kodValue = kodCol ? readCellText(row.getCell(kodCol).value).trim() : '';

    items.push({
      pc: pcValue || null,
      kod: kodValue || null,
      jcena: jcCol ? safeNumericValue(row.getCell(jcCol).value) : null,
      celkem: celCol ? safeNumericValue(row.getCell(celCol).value) : null,
      radek: rowIndex,
    });
  }

  return {
    items,
    headerRow,
    columnMap,
    kRows,
  };
};

export const analyzeWorkbookFile = async (filePath: string): Promise<DetectionAnalysis> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    return {
      headerRow: null,
      kRows: 0,
      pricedKRows: 0,
      columnMap: {},
      isValidTemplate: false,
    };
  }

  const headerRow = findHeaderRow(worksheet);
  if (!headerRow) {
    return {
      headerRow: null,
      kRows: 0,
      pricedKRows: 0,
      columnMap: {},
      isValidTemplate: false,
    };
  }

  const columnMap = findColumns(worksheet, headerRow);
  if (!columnMap.typ || (!columnMap.kod && !columnMap.pc)) {
    return {
      headerRow,
      kRows: 0,
      pricedKRows: 0,
      columnMap,
      isValidTemplate: false,
    };
  }

  let kRows = 0;
  let pricedKRows = 0;

  for (let rowIndex = headerRow + 1; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const typ = normalizeText(readCellText(row.getCell(columnMap.typ).value)).toUpperCase();
    if (typ !== 'K') continue;

    kRows += 1;
    if (columnMap.jcena) {
      const price = safeNumericValue(row.getCell(columnMap.jcena).value);
      if (price != null) pricedKRows += 1;
    }
  }

  return {
    headerRow,
    kRows,
    pricedKRows,
    columnMap,
    isValidTemplate: kRows > 0,
  };
};

const colLetter = (column: number): string => {
  let num = column;
  let output = '';
  while (num > 0) {
    const remainder = (num - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    num = Math.floor((num - 1) / 26);
  }
  return output;
};

const createLookup = (items: BidComparisonItem[]) => {
  const byKod = new Map<string, BidComparisonItem>();
  const byPc = new Map<string, BidComparisonItem>();

  items.forEach((item) => {
    if (item.kod) byKod.set(item.kod.trim(), item);
    if (item.pc) byPc.set(item.pc.trim(), item);
  });

  return { byKod, byPc };
};

export const buildComparisonWorkbook = async (
  input: BuildComparisonInput,
): Promise<BuildComparisonResult> => {
  const { zadaniPath, offers, onProgress, isCancelled } = input;

  if (offers.length === 0) {
    throw new Error('Nebyla vybrána žádná nabídka k porovnání.');
  }

  onProgress?.(5, 'Načítám zadání...');

  const zadaniWorkbook = new ExcelJS.Workbook();
  await zadaniWorkbook.xlsx.readFile(zadaniPath);
  const zadaniSheet = zadaniWorkbook.worksheets[0];
  if (!zadaniSheet) {
    throw new Error('Soubor zadání neobsahuje žádný list.');
  }

  const parsedZadani = parseWorksheet(zadaniSheet);

  if (!parsedZadani.columnMap.mnozstvi) {
    throw new Error('V zadání chybí sloupec Množství.');
  }

  onProgress?.(10, 'Načítám nabídky dodavatelů...');

  const parsedOffers = await Promise.all(
    offers.map(async (offer) => {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(offer.filePath);
      const sheet = workbook.worksheets[0];
      if (!sheet) {
        throw new Error(`Soubor "${offer.filePath}" neobsahuje žádný list.`);
      }
      return {
        offer,
        parsed: parseWorksheet(sheet),
      };
    }),
  );

  if (isCancelled?.()) {
    throw new Error('Porovnání bylo zrušeno.');
  }

  const startColumn = zadaniSheet.columnCount + 1;
  const titleRow = Math.max(1, parsedZadani.headerRow - 2);
  const sumRow = Math.max(1, parsedZadani.headerRow - 1);
  const recapRow = parsedZadani.headerRow + 1;
  const quantityCol = parsedZadani.columnMap.mnozstvi;

  const suppliers: BuildComparisonResult['suppliers'] = {};

  parsedOffers.forEach((entry, offerIndex) => {
    const palette = PALETTE[offerIndex % PALETTE.length];
    const headerFill: ExcelJS.FillPattern = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: toArgb(palette.header) },
    };
    const totalFill: ExcelJS.FillPattern = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: toArgb(palette.total) },
    };

    const colJcena = startColumn + offerIndex * 2;
    const colCelkem = colJcena + 1;
    const letterJcena = colLetter(colJcena);
    const letterCelkem = colLetter(colCelkem);

    const supplierTitleCell = zadaniSheet.getCell(titleRow, colJcena);
    supplierTitleCell.value = entry.offer.displayLabel;
    supplierTitleCell.font = {
      name: 'Arial',
      size: 11,
      bold: true,
      color: { argb: toArgb(palette.fontColor) },
    };
    supplierTitleCell.fill = headerFill;
    supplierTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    zadaniSheet.mergeCells(titleRow, colJcena, titleRow, colCelkem);

    const headerJ = zadaniSheet.getCell(parsedZadani.headerRow, colJcena);
    headerJ.value = 'J.cena [CZK]';
    headerJ.font = { name: 'Arial', size: 10, bold: true };
    headerJ.fill = headerFill;
    headerJ.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerJ.border = BORDER_THIN;

    const headerK = zadaniSheet.getCell(parsedZadani.headerRow, colCelkem);
    headerK.value = 'Cena celkem [CZK]';
    headerK.font = { name: 'Arial', size: 10, bold: true };
    headerK.fill = headerFill;
    headerK.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerK.border = BORDER_THIN;

    zadaniSheet.getColumn(colJcena).width = 14;
    zadaniSheet.getColumn(colCelkem).width = 18;

    const lookup = createLookup(entry.parsed.items);
    let matched = 0;
    const unmatched: string[] = [];

    parsedZadani.items.forEach((zadaniItem) => {
      if (isCancelled?.()) {
        throw new Error('Porovnání bylo zrušeno.');
      }

      let offerItem: BidComparisonItem | undefined;
      if (zadaniItem.kod) {
        offerItem = lookup.byKod.get(zadaniItem.kod.trim());
      }
      if (!offerItem && zadaniItem.pc) {
        offerItem = lookup.byPc.get(zadaniItem.pc.trim());
      }

      if (!offerItem || offerItem.jcena == null) {
        unmatched.push(zadaniItem.kod || zadaniItem.pc || `řádek ${zadaniItem.radek}`);
        return;
      }

      matched += 1;

      const jcCell = zadaniSheet.getCell(zadaniItem.radek, colJcena);
      jcCell.value = offerItem.jcena;
      jcCell.font = { name: 'Arial', size: 10 };
      jcCell.numFmt = NUMBER_FORMAT;
      jcCell.fill = headerFill;
      jcCell.border = BORDER_THIN;

      const celCell = zadaniSheet.getCell(zadaniItem.radek, colCelkem);
      celCell.value = {
        formula: `${letterJcena}${zadaniItem.radek}*${colLetter(quantityCol)}${zadaniItem.radek}`,
      };
      celCell.font = { name: 'Arial', size: 10 };
      celCell.numFmt = NUMBER_FORMAT;
      celCell.fill = headerFill;
      celCell.border = BORDER_THIN;
    });

    const recapCell = zadaniSheet.getCell(recapRow, colCelkem);
    const recapTerms = parsedZadani.kRows.map((rowIndex) => `${letterCelkem}${rowIndex}`);
    recapCell.value = recapTerms.length
      ? { formula: recapTerms.join('+') }
      : { formula: '0' };
    recapCell.font = { name: 'Arial', size: 10, bold: true };
    recapCell.numFmt = NUMBER_FORMAT;
    recapCell.fill = totalFill;
    recapCell.border = BORDER_THIN;

    const sumCell = zadaniSheet.getCell(sumRow, colCelkem);
    sumCell.value = { formula: `${letterCelkem}${recapRow}` };
    sumCell.font = {
      name: 'Arial',
      size: 11,
      bold: true,
      color: { argb: toArgb(palette.fontColor) },
    };
    sumCell.numFmt = NUMBER_FORMAT;
    sumCell.fill = totalFill;

    suppliers[entry.offer.displayLabel] = {
      sparovano: matched,
      nesparovano: unmatched,
      round: entry.offer.round,
      variant: entry.offer.variant,
    };

    const progress = 20 + Math.round(((offerIndex + 1) / parsedOffers.length) * 75);
    onProgress?.(Math.min(progress, 95), `Zpracováno: ${entry.offer.displayLabel}`);
  });

  if (isCancelled?.()) {
    throw new Error('Porovnání bylo zrušeno.');
  }

  onProgress?.(98, 'Generuji výstupní soubor...');
  const outputBuffer = Buffer.from(await zadaniWorkbook.xlsx.writeBuffer());

  onProgress?.(100, 'Hotovo');

  return {
    outputBuffer,
    pocetPolozek: parsedZadani.items.length,
    suppliers,
  };
};
