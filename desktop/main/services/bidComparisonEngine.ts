import ExcelJS from 'exceljs';
import type { BidComparisonEvaluation, BidComparisonInputFingerprint } from '../types';

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
  popis: string | null;
  mj: string | null;
  mnozstvi: number | null;
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
  zadaniPath?: string;
  offers: BidOfferInput[];
  agentRecommendation?: BidComparisonAgentRecommendation | null;
  evaluation?: BidComparisonEvaluation | null;
  requestId?: string;
  inputFingerprints?: BidComparisonInputFingerprint[];
  onProgress?: (percent: number, step: string) => void;
  isCancelled?: () => boolean;
}

export interface BidComparisonMatrixOffer {
  supplierName: string;
  displayLabel: string;
  round: number;
  variant: number;
  jcena: number | null;
  celkem: number | null;
  matched: boolean;
}

export interface BidComparisonMatrixItem {
  pc: string | null;
  kod: string | null;
  popis: string | null;
  mj: string | null;
  mnozstvi: number | null;
  radek: number;
  offers: Record<string, BidComparisonMatrixOffer>;
}

export interface BidComparisonAgentRisk {
  severity: 'low' | 'medium' | 'high';
  itemKod?: string | null;
  itemPc?: string | null;
  supplierName?: string | null;
  title: string;
  detail: string;
}

export interface BidComparisonAgentRecommendation {
  summary: string;
  recommendedSupplier?: string | null;
  nextSteps: string[];
  risks: BidComparisonAgentRisk[];
}

export interface BuildComparisonResult {
  outputBuffer: Buffer;
  pocetPolozek: number;
  sourceMode: 'zadani' | 'offers_only';
  matrix: BidComparisonMatrixItem[];
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
const BEST_PRICE_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFC6EFCE' },
};
const MISSING_PRICE_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFF2CC' },
};

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
    const popisValue = columnMap.popis ? readCellText(row.getCell(columnMap.popis).value).trim() : '';
    const mjValue = columnMap.mj ? readCellText(row.getCell(columnMap.mj).value).trim() : '';

    items.push({
      pc: pcValue || null,
      kod: kodValue || null,
      popis: popisValue || null,
      mj: mjValue || null,
      mnozstvi: columnMap.mnozstvi ? safeNumericValue(row.getCell(columnMap.mnozstvi).value) : null,
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
  const byDescriptionUnit = new Map<string, BidComparisonItem>();
  const ambiguousDescriptionUnits = new Set<string>();

  const descriptionUnitKey = (item: Pick<BidComparisonItem, 'popis' | 'mj'>): string | null => {
    const description = item.popis?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const unit = item.mj?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
    return description && unit ? `${description}::${unit}` : null;
  };

  items.forEach((item) => {
    if (item.kod) byKod.set(item.kod.trim(), item);
    if (item.pc) byPc.set(item.pc.trim(), item);
    const key = descriptionUnitKey(item);
    if (key && !ambiguousDescriptionUnits.has(key)) {
      if (byDescriptionUnit.has(key)) {
        byDescriptionUnit.delete(key);
        ambiguousDescriptionUnits.add(key);
      } else {
        byDescriptionUnit.set(key, item);
      }
    }
  });

  return { byKod, byPc, byDescriptionUnit, descriptionUnitKey };
};

const calculateTotal = (item: BidComparisonItem, quantity: number | null): number | null => {
  if (item.celkem != null) return item.celkem;
  if (item.jcena == null || quantity == null) return null;
  return item.jcena * quantity;
};

const highlightBestPrices = (
  sheet: ExcelJS.Worksheet,
  matrix: BidComparisonMatrixItem[],
  parsedOffers: Array<{ offer: BidOfferInput }>,
  startColumn: number,
): void => {
  matrix.forEach((item) => {
    const totals = Object.values(item.offers)
      .map((offer) => offer.celkem)
      .filter((value): value is number => value != null && Number.isFinite(value));

    if (!totals.length) return;

    const minTotal = Math.min(...totals);
    parsedOffers.forEach((entry, offerIndex) => {
      const offer = item.offers[entry.offer.displayLabel];
      if (!offer || offer.celkem !== minTotal) return;

      const colJcena = startColumn + offerIndex * 2;
      const colCelkem = colJcena + 1;
      [colJcena, colCelkem].forEach((columnIndex) => {
        const cell = sheet.getCell(item.radek, columnIndex);
        cell.fill = BEST_PRICE_FILL;
        cell.font = {
          ...cell.font,
          bold: true,
          color: { argb: 'FF006100' },
        };
      });
    });
  });
};

const getItemKey = (item: BidComparisonItem): string | null => {
  const kod = item.kod?.trim();
  if (kod) return `kod:${kod}`;

  const pc = item.pc?.trim();
  if (pc) return `pc:${pc}`;

  return null;
};

const createOfferOnlyWorkbook = (
  parsedOffers: Array<{
    offer: BidOfferInput;
    parsed: ParsedSheetResult;
  }>,
): { workbook: ExcelJS.Workbook; sheet: ExcelJS.Worksheet; parsedSheet: ParsedSheetResult } => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Porovnání nabídek');
  const headerRow = 3;
  const recapRow = 4;
  const firstItemRow = 5;
  const columnMap: HeaderColumnMap = {
    pc: 1,
    typ: 2,
    kod: 3,
    popis: 4,
    mj: 5,
    mnozstvi: 6,
  };

  sheet.getCell(1, 1).value = 'Porovnání nabídek bez souboru zadání';
  sheet.getCell(1, 1).font = { name: 'Arial', size: 12, bold: true };
  sheet.getCell(2, 1).value = 'Položky jsou složené z dodaných nabídek.';
  sheet.getCell(2, 1).font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF666666' } };

  const headers = ['PČ', 'Typ', 'Kód', 'Popis', 'MJ', 'Množství'];
  headers.forEach((header, index) => {
    const cell = sheet.getCell(headerRow, index + 1);
    cell.value = header;
    cell.font = { name: 'Arial', size: 10, bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE7E6E6' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDER_THIN;
  });

  sheet.getRow(recapRow).values = ['', 'R', '', 'REKAPITULACE', '', ''];
  sheet.getRow(recapRow).font = { name: 'Arial', size: 10, bold: true };

  const seen = new Set<string>();
  const items: BidComparisonItem[] = [];

  parsedOffers.forEach((entry) => {
    entry.parsed.items.forEach((item) => {
      const baseKey = getItemKey(item);
      const key = baseKey || `file:${entry.offer.displayLabel}:row:${item.radek}`;
      if (seen.has(key)) return;
      seen.add(key);

      items.push({
        ...item,
        radek: firstItemRow + items.length,
      });
    });
  });

  items.forEach((item) => {
    const row = sheet.getRow(item.radek);
    row.getCell(columnMap.pc!).value = item.pc || '';
    row.getCell(columnMap.typ!).value = 'K';
    row.getCell(columnMap.kod!).value = item.kod || '';
    row.getCell(columnMap.popis!).value = item.popis || '';
    row.getCell(columnMap.mj!).value = item.mj || '';
    row.getCell(columnMap.mnozstvi!).value = item.mnozstvi ?? null;
  });

  sheet.getColumn(1).width = 12;
  sheet.getColumn(2).width = 8;
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 48;
  sheet.getColumn(5).width = 10;
  sheet.getColumn(6).width = 12;

  return {
    workbook,
    sheet,
    parsedSheet: {
      items,
      headerRow,
      columnMap,
      kRows: items.map((item) => item.radek),
    },
  };
};

const getSeverityLabel = (severity: BidComparisonAgentRisk['severity']): string => {
  if (severity === 'high') return 'Vysoké';
  if (severity === 'medium') return 'Střední';
  return 'Nízké';
};

const writeAgentRecommendationSheet = (
  workbook: ExcelJS.Workbook,
  recommendation: BidComparisonAgentRecommendation,
): void => {
  const sheetName = 'Agent doporučení';
  const existing = workbook.getWorksheet(sheetName);
  if (existing) {
    workbook.removeWorksheet(existing.id);
  }

  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = [
    { header: 'Sekce', key: 'section', width: 22 },
    { header: 'Hodnota', key: 'value', width: 42 },
    { header: 'Detail', key: 'detail', width: 72 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2EFDA' },
  };

  sheet.addRow({
    section: 'Shrnutí',
    value: recommendation.recommendedSupplier || '',
    detail: recommendation.summary,
  });

  if (recommendation.nextSteps.length > 0) {
    recommendation.nextSteps.forEach((step, index) => {
      sheet.addRow({
        section: index === 0 ? 'Doporučené kroky' : '',
        value: `${index + 1}. krok`,
        detail: step,
      });
    });
  }

  if (recommendation.risks.length > 0) {
    recommendation.risks.forEach((risk) => {
      const labels = [
        risk.itemKod ? `Kód: ${risk.itemKod}` : null,
        risk.itemPc ? `PČ: ${risk.itemPc}` : null,
        risk.supplierName ? `Dodavatel: ${risk.supplierName}` : null,
      ].filter(Boolean).join(' | ');
      sheet.addRow({
        section: 'Riziko',
        value: `${getSeverityLabel(risk.severity)}: ${risk.title}`,
        detail: labels ? `${labels}\n${risk.detail}` : risk.detail,
      });
    });
  }

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = BORDER_THIN;
    });
  });
};

const writeEvaluationSheet = (
  workbook: ExcelJS.Workbook,
  evaluation: BidComparisonEvaluation,
  requestId?: string,
  inputFingerprints: BidComparisonInputFingerprint[] = [],
): void => {
  const existing = workbook.getWorksheet('Vyhodnocení');
  if (existing) workbook.removeWorksheet(existing.id);
  const sheet = workbook.addWorksheet('Vyhodnocení');
  sheet.addRow(['Poradní vyhodnocení nabídek']);
  sheet.addRow(['Request ID', requestId || '']);
  sheet.addRow(['Verze algoritmu', evaluation.algorithmVersion]);
  sheet.addRow(['Váhy', 'Cena', 'Úplnost', 'Obchodní podmínky', 'Historie', 'Cenová rizika']);
  sheet.addRow(['Požadované %', evaluation.requestedWeights.price, evaluation.requestedWeights.completeness, evaluation.requestedWeights.commercialTerms, evaluation.requestedWeights.supplierHistory, evaluation.requestedWeights.priceRisk]);
  sheet.addRow(['Efektivní %', evaluation.effectiveWeights.price, evaluation.effectiveWeights.completeness, evaluation.effectiveWeights.commercialTerms, evaluation.effectiveWeights.supplierHistory, evaluation.effectiveWeights.priceRisk]);
  sheet.addRow([]);
  sheet.addRow(['Pořadí', 'Dodavatel', 'Varianta', 'Cena celkem', 'Skóre', 'Cena', 'Úplnost', 'Obchodní podmínky', 'Historie', 'Cenová rizika', 'Chybějící údaje']);
  evaluation.scores.forEach((score) => {
    const row = sheet.addRow([
      score.rank,
      score.supplierName,
      score.displayLabel,
      score.totalPrice,
      null,
      score.scores.price,
      score.scores.completeness,
      score.scores.commercialTerms,
      score.scores.supplierHistory,
      score.scores.priceRisk,
      score.missingCriteria.join(', '),
    ]);
    row.getCell(5).value = {
      formula: `ROUND(F${row.number}*$B$6/100+G${row.number}*$C$6/100+H${row.number}*$D$6/100+I${row.number}*$E$6/100+J${row.number}*$F$6/100,2)`,
      result: score.totalScore,
    };
  });
  if (evaluation.warnings.length) {
    sheet.addRow([]);
    sheet.addRow(['Varování']);
    evaluation.warnings.forEach((warning) => sheet.addRow([warning]));
  }
  if (evaluation.anomalies.length) {
    sheet.addRow([]);
    sheet.addRow(['Cenové anomálie']);
    sheet.addRow(['Položka', 'Dodavatel', 'Varianta', 'Cena', 'Medián', 'Odchylka %', 'Směr']);
    evaluation.anomalies.forEach((anomaly) => sheet.addRow([anomaly.itemKey, anomaly.supplierName, anomaly.displayLabel, anomaly.price, anomaly.median, anomaly.deviationPercent, anomaly.direction === 'low' ? 'nízká' : 'vysoká']));
  }
  if (inputFingerprints.length) {
    sheet.addRow([]);
    sheet.addRow(['Otisky vstupních souborů']);
    sheet.addRow(['Soubor', 'SHA-256']);
    inputFingerprints.forEach((fingerprint) => sheet.addRow([fingerprint.fileName, fingerprint.sha256]));
  }
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.getRow(8).font = { bold: true };
  sheet.columns.forEach((column) => { column.width = Math.min(48, Math.max(14, column.width || 14)); });
};

export const buildComparisonWorkbook = async (
  input: BuildComparisonInput,
): Promise<BuildComparisonResult> => {
  const { zadaniPath, offers, agentRecommendation, evaluation, requestId, inputFingerprints, onProgress, isCancelled } = input;

  if (offers.length === 0) {
    throw new Error('Nebyla vybrána žádná nabídka k porovnání.');
  }

  onProgress?.(5, zadaniPath ? 'Načítám zadání...' : 'Připravuji porovnání z nabídek...');

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

  let zadaniWorkbook: ExcelJS.Workbook;
  let zadaniSheet: ExcelJS.Worksheet;
  let parsedZadani: ParsedSheetResult;
  let sourceMode: BuildComparisonResult['sourceMode'];

  if (zadaniPath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(zadaniPath);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new Error('Soubor zadání neobsahuje žádný list.');
    }

    const parsed = parseWorksheet(sheet);

    if (!parsed.columnMap.mnozstvi) {
      throw new Error('V zadání chybí sloupec Množství.');
    }

    zadaniWorkbook = workbook;
    zadaniSheet = sheet;
    parsedZadani = parsed;
    sourceMode = 'zadani';
  } else {
    const generated = createOfferOnlyWorkbook(parsedOffers);
    zadaniWorkbook = generated.workbook;
    zadaniSheet = generated.sheet;
    parsedZadani = generated.parsedSheet;
    sourceMode = 'offers_only';
  }

  const startColumn = zadaniSheet.columnCount + 1;
  const titleRow = Math.max(1, parsedZadani.headerRow - 2);
  const sumRow = Math.max(1, parsedZadani.headerRow - 1);
  const recapRow = parsedZadani.headerRow + 1;
  const quantityCol = parsedZadani.columnMap.mnozstvi;
  if (!quantityCol) {
    throw new Error('V porovnání chybí sloupec Množství.');
  }

  const suppliers: BuildComparisonResult['suppliers'] = {};
  const matrix: BidComparisonMatrixItem[] = parsedZadani.items.map((item) => ({
    pc: item.pc,
    kod: item.kod,
    popis: item.popis,
    mj: item.mj,
    mnozstvi: item.mnozstvi,
    radek: item.radek,
    offers: {},
  }));

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

    parsedZadani.items.forEach((zadaniItem, itemIndex) => {
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
      if (!offerItem) {
        const descriptionKey = lookup.descriptionUnitKey(zadaniItem);
        if (descriptionKey) offerItem = lookup.byDescriptionUnit.get(descriptionKey);
      }

      if (!offerItem || offerItem.jcena == null) {
        unmatched.push(zadaniItem.kod || zadaniItem.pc || `řádek ${zadaniItem.radek}`);
        matrix[itemIndex].offers[entry.offer.displayLabel] = {
          supplierName: entry.offer.supplierName,
          displayLabel: entry.offer.displayLabel,
          round: entry.offer.round,
          variant: entry.offer.variant,
          jcena: null,
          celkem: null,
          matched: false,
        };
        [colJcena, colCelkem].forEach((columnIndex) => {
          const cell = zadaniSheet.getCell(zadaniItem.radek, columnIndex);
          cell.value = '-';
          cell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF9C6500' } };
          cell.fill = MISSING_PRICE_FILL;
          cell.border = BORDER_THIN;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        return;
      }

      matched += 1;
      matrix[itemIndex].offers[entry.offer.displayLabel] = {
        supplierName: entry.offer.supplierName,
        displayLabel: entry.offer.displayLabel,
        round: entry.offer.round,
        variant: entry.offer.variant,
        jcena: offerItem.jcena,
        celkem: calculateTotal(offerItem, zadaniItem.mnozstvi),
        matched: true,
      };

      const jcCell = zadaniSheet.getCell(zadaniItem.radek, colJcena);
      jcCell.value = offerItem.jcena;
      jcCell.font = { name: 'Arial', size: 10 };
      jcCell.numFmt = NUMBER_FORMAT;
      jcCell.fill = headerFill;
      jcCell.border = BORDER_THIN;

      const celCell = zadaniSheet.getCell(zadaniItem.radek, colCelkem);
      celCell.value = {
        formula: `${letterJcena}${zadaniItem.radek}*${colLetter(quantityCol)}${zadaniItem.radek}`,
      } as ExcelJS.CellFormulaValue;
      celCell.font = { name: 'Arial', size: 10 };
      celCell.numFmt = NUMBER_FORMAT;
      celCell.fill = headerFill;
      celCell.border = BORDER_THIN;
    });

    const recapCell = zadaniSheet.getCell(recapRow, colCelkem);
    const recapTerms = parsedZadani.kRows.map((rowIndex) => `${letterCelkem}${rowIndex}`);
    recapCell.value = (recapTerms.length
      ? { formula: `SUM(${recapTerms.join(',')})` }
      : { formula: '0' }) as ExcelJS.CellFormulaValue;
    recapCell.font = { name: 'Arial', size: 10, bold: true };
    recapCell.numFmt = NUMBER_FORMAT;
    recapCell.fill = totalFill;
    recapCell.border = BORDER_THIN;

    const sumCell = zadaniSheet.getCell(sumRow, colCelkem);
    sumCell.value = { formula: `${letterCelkem}${recapRow}` } as ExcelJS.CellFormulaValue;
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

  highlightBestPrices(zadaniSheet, matrix, parsedOffers, startColumn);

  if (isCancelled?.()) {
    throw new Error('Porovnání bylo zrušeno.');
  }

  if (evaluation) {
    onProgress?.(95, 'Zapisuji bodové vyhodnocení...');
    writeEvaluationSheet(zadaniWorkbook, evaluation, requestId, inputFingerprints);
  }

  if (agentRecommendation) {
    onProgress?.(96, 'Zapisuji doporučení agenta...');
    writeAgentRecommendationSheet(zadaniWorkbook, agentRecommendation);
  }

  onProgress?.(98, 'Generuji výstupní soubor...');
  const outputBuffer = Buffer.from(await zadaniWorkbook.xlsx.writeBuffer());

  onProgress?.(100, 'Hotovo');

  return {
    outputBuffer,
    pocetPolozek: parsedZadani.items.length,
    sourceMode,
    matrix,
    suppliers,
  };
};
