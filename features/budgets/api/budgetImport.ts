import * as XLSX from "xlsx";
import type {
  ProjectBudgetImportItemInput,
  ProjectBudgetImportResult,
  ProjectBudgetVatRate,
} from "../model/budgetTypes";
const MAX_IMPORT_ROWS = 5000;
const MAX_IMPORT_FILE_SIZE = 50 * 1024 * 1024;
const MAX_SKIPPED_ROW_DETAILS = 200;
const SUPPORTED_IMPORT_EXTENSIONS = new Set(["xlsx", "xlsm", "xlsb", "xls", "ods"]);

type BudgetImportField =
  | "order"
  | "rowType"
  | "code"
  | "name"
  | "unit"
  | "amount"
  | "unitPrice"
  | "category"
  | "vatRate";

export type BudgetImportColumnField = Exclude<BudgetImportField, "rowType">;

export type BudgetImportColumnOverrides = Partial<Record<BudgetImportColumnField, number>>;

export type ParsedBudgetImportColumnIndices = Partial<Record<BudgetImportColumnField, number>>;

export type ParsedBudgetImportColumns = Partial<Record<BudgetImportColumnField, string>>;

export interface ParsedBudgetImportRow extends ProjectBudgetImportItemInput {
  sourceRowNumber: number;
  unitPriceColumnIndex?: number;
}

export interface ParsedBudgetImportSkippedRow {
  sheetName: string;
  rowNumber: number;
  reason: string;
  values: string[];
}

export interface ParsedBudgetImport {
  fileName: string;
  sheetNames: string[];
  rows: ParsedBudgetImportRow[];
  totalRows: number;
  skippedRows: number;
  skippedRowDetails: ParsedBudgetImportSkippedRow[];
  mappedColumns: ParsedBudgetImportColumns;
  mappedColumnIndices: ParsedBudgetImportColumnIndices;
  headerRow: string[];
  headerRowNumber: number;
  headerSheetName: string;
  warnings: string[];
}

export interface ParseBudgetWorkbookOptions {
  maxRows?: number;
  columnOverrides?: BudgetImportColumnOverrides;
}

const FIELD_KEYWORDS: Record<BudgetImportField, string[]> = {
  order: ["p c", "pc", "por c", "por cislo", "poradove cislo", "poradi"],
  rowType: ["typ", "type", "druh"],
  code: ["kod", "kód", "polozky", "položky", "cislo polozky", "číslo položky"],
  name: ["popis", "nazev", "název", "specifikace", "polozka", "položka"],
  unit: ["mj", "merna", "měrná", "jednotka"],
  amount: ["mnozstvi", "množství", "vymera", "výměra", "mnozstvi vv", "množství vv"],
  unitPrice: ["jednotkova cena", "jednotková cena", "j.cena", "jc", "cena/mj", "cena za mj"],
  category: ["kapitola", "oddil", "oddíl", "objekt", "cast", "část"],
  vatRate: ["dph"],
};

const MAPPABLE_FIELDS: BudgetImportColumnField[] = [
  "order",
  "code",
  "name",
  "unit",
  "amount",
  "unitPrice",
  "category",
  "vatRate",
];

const normalizeText = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");

const rawText = (value: unknown): string => String(value ?? "").trim();
const normalizeEmptyToken = (value: string): string =>
  normalizeText(value).replace(/[-–—_]+/g, "").trim();

const positionLabelFromCell = (value: unknown): string | null => {
  const raw = rawText(value);
  if (!raw) return null;
  const normalized = raw
    .replace(/\s+/g, "")
    .replace(/,+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return normalized || null;
};

const parseImportNumber = (value: unknown): number | null => {
  const raw = rawText(value);
  if (!raw) return null;
  let normalized = raw
    .replace(/[\u00a0\u202f\s]/g, "")
    .replace("Kč", "")
    .replace("CZK", "")
    .replace("%", "")
    .trim();

  if (normalized.startsWith("(") && normalized.endsWith(")")) {
    normalized = `-${normalized.slice(1, -1)}`;
  }
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseVatRate = (value: unknown): ProjectBudgetVatRate => {
  const parsed = parseImportNumber(value);
  if (parsed === 0 || parsed === 12 || parsed === 21) return parsed;
  return 21;
};

const BUDGET_SECTIONS: Record<string, string> = {
  "1": "1 - Zemní práce",
  "2": "2 - Zakládání a zvláštní zakládání",
  "3": "3 - Svislé a kompletní konstrukce",
  "4": "4 - Vodorovné konstrukce",
  "5": "5 - Komunikace",
  "6": "6 - Úpravy povrchů, podlahy a osazování výplní",
  "8": "8 - Trubní vedení",
  "9": "9 - Ostatní konstrukce a práce, bourání",
  "711": "711 - Izolace proti vodě, vlhkosti a plynům",
  "712": "712 - Povlakové krytiny",
  "713": "713 - Izolace tepelné",
  "721": "721 - Zdravotechnika - vnitřní kanalizace",
  "722": "722 - Zdravotechnika - vnitřní vodovod",
  "725": "725 - Zdravotechnika - zařizovací předměty",
  "731": "731 - Ústřední vytápění - kotelny",
  "732": "732 - Ústřední vytápění - strojovny",
  "733": "733 - Ústřední vytápění - rozvodné potrubí",
  "734": "734 - Ústřední vytápění - armatury",
  "735": "735 - Ústřední vytápění - otopná tělesa",
  "751": "751 - Vzduchotechnika",
  "762": "762 - Konstrukce tesařské",
  "763": "763 - Konstrukce suché výstavby",
  "764": "764 - Konstrukce klempířské",
  "765": "765 - Krytiny skládané",
  "766": "766 - Konstrukce truhlářské",
  "767": "767 - Konstrukce zámečnické",
  "771": "771 - Podlahy z dlaždic",
  "775": "775 - Podlahy skládané",
  "776": "776 - Podlahy povlakové",
  "781": "781 - Dokončovací práce - obklady",
  "783": "783 - Dokončovací práce - nátěry",
  "784": "784 - Dokončovací práce - malby a tapety",
};

const isRecapSheetName = (sheetName: string): boolean => {
  const normalized = normalizeText(sheetName);
  return normalized === "rekapitulace"
    || normalized.startsWith("rekapitulace ")
    || normalized === "souhrn"
    || normalized === "souhrnny list"
    || normalized === "kryci list"
    || normalized === "krycilist"
    || normalized === "summary"
    || normalized === "cover"
    || normalized === "obsah";
};

const codeDigits = (value: string): string => {
  const match = value.trim().match(/\d+/);
  return match?.[0] ?? "";
};

const budgetSectionFromCode = (code: string): string | null => {
  const digits = codeDigits(code);
  if (!digits) return null;
  if (digits.startsWith("7") && digits.length >= 3 && BUDGET_SECTIONS[digits.slice(0, 3)]) {
    return BUDGET_SECTIONS[digits.slice(0, 3)];
  }
  return BUDGET_SECTIONS[digits.slice(0, 1)] ?? null;
};

const budgetSectionFromLabel = (label: string): string | null => {
  const normalized = normalizeText(label);
  const numericPart = normalized.split(/\s+/).find((part) => /^\d+$/.test(part));
  if (numericPart) {
    if (numericPart.startsWith("7") && numericPart.length >= 3 && BUDGET_SECTIONS[numericPart.slice(0, 3)]) {
      return BUDGET_SECTIONS[numericPart.slice(0, 3)];
    }
    if (BUDGET_SECTIONS[numericPart.slice(0, 1)]) return BUDGET_SECTIONS[numericPart.slice(0, 1)];
  }

  if (normalized.includes("zemni prace")) return BUDGET_SECTIONS["1"];
  if (normalized.includes("zakladani") || normalized.includes("podzemni dila")) return BUDGET_SECTIONS["2"];
  if (normalized.includes("svisle") || normalized.includes("kompletni konstrukce")) return BUDGET_SECTIONS["3"];
  if (normalized.includes("vodorovne konstrukce")) return BUDGET_SECTIONS["4"];
  if (normalized.includes("komunikace")) return BUDGET_SECTIONS["5"];
  if (normalized.includes("upravy povrchu") || normalized.includes("podlahy a osazovani vyplni")) return BUDGET_SECTIONS["6"];
  if (normalized.includes("trubni vedeni")) return BUDGET_SECTIONS["8"];
  if (normalized.includes("ostatni konstrukce") || normalized.includes("bourani") || normalized.includes("demolice")) return BUDGET_SECTIONS["9"];
  if (normalized.includes("izolace proti vode")) return BUDGET_SECTIONS["711"];
  if (normalized.includes("povlakove krytiny")) return BUDGET_SECTIONS["712"];
  if (normalized.includes("izolace tepelne")) return BUDGET_SECTIONS["713"];
  if (normalized.includes("vnitrni kanalizace")) return BUDGET_SECTIONS["721"];
  if (normalized.includes("vnitrni vodovod")) return BUDGET_SECTIONS["722"];
  if (normalized.includes("zarizovaci predmety")) return BUDGET_SECTIONS["725"];
  if (normalized.includes("vzduchotechnika")) return BUDGET_SECTIONS["751"];
  if (normalized.includes("tesarske")) return BUDGET_SECTIONS["762"];
  if (normalized.includes("suche vystavby")) return BUDGET_SECTIONS["763"];
  if (normalized.includes("klempirske")) return BUDGET_SECTIONS["764"];
  if (normalized.includes("krytiny skladane")) return BUDGET_SECTIONS["765"];
  if (normalized.includes("truhlarske")) return BUDGET_SECTIONS["766"];
  if (normalized.includes("zamecnicke")) return BUDGET_SECTIONS["767"];
  if (normalized.includes("podlahy z dlazdic")) return BUDGET_SECTIONS["771"];
  if (normalized.includes("podlahy skladane")) return BUDGET_SECTIONS["775"];
  if (normalized.includes("podlahy povlakove")) return BUDGET_SECTIONS["776"];
  if (normalized.includes("obklady")) return BUDGET_SECTIONS["781"];
  if (normalized.includes("natery")) return BUDGET_SECTIONS["783"];
  if (normalized.includes("malby") || normalized.includes("tapety")) return BUDGET_SECTIONS["784"];
  return null;
};

const stripCategoryPrefix = (value: string): string => {
  const trimmed = value.trim();
  const withoutPrefix = trimmed.replace(/^\s*(kapitola|odd[ií]l|d[ií]l|soubor)\s*[:.\-–—]?\s*/i, "").trim();
  return withoutPrefix || trimmed;
};

const categoryNameFromRow = (
  row: unknown[],
  columns: Partial<Record<BudgetImportField, number>>,
): string | null => {
  const name = rawText(cellAt(row, columns.name));
  if (!name) return null;

  const normalizedName = normalizeText(name);
  const explicitCategoryLabel = /^(kapitola|oddil|dil|soubor)\b/.test(normalizedName);
  if (!explicitCategoryLabel) return null;

  const unit = rawText(cellAt(row, columns.unit));
  const amount = rawText(cellAt(row, columns.amount));
  const price = rawText(cellAt(row, columns.unitPrice));
  const code = rawText(cellAt(row, columns.code));
  const hasItemShape =
    isPlausibleUnit(unit)
    || parseImportNumber(amount) !== null
    || parseImportNumber(price) !== null;

  if (hasItemShape) return null;

  const codeIsEmptyLike = !normalizeEmptyToken(code);
  if (!codeIsEmptyLike && row.filter((value) => rawText(value)).length > 3) return null;

  return stripCategoryPrefix(name);
};

const normalizeUnitToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\u00b2/g, "2")
    .replace(/\u00b3/g, "3")
    .replace(/[^a-z0-9%]/g, "");

const canonicalUnit = (value: string): string | null => {
  const token = normalizeUnitToken(value);
  if (!token) return null;
  if (["kus", "kusu", "kusy", "kuse"].includes(token)) return "ks";
  if (["komplet", "komplety", "soub", "soubor"].includes(token)) return "kpl";
  if (token === "procento") return "%";
  return token;
};

const isPlausibleUnit = (value: string): boolean => {
  const token = normalizeUnitToken(value);
  if (!token || token.length > 16) return false;
  return [
    "m", "bm", "mm", "cm", "km", "m2", "m3", "m3op", "ha", "a", "ks", "kus", "kpl", "t",
    "kg", "g", "l", "hod", "h", "den", "d", "mes", "tkm", "procento", "%",
  ].includes(token) || /^[a-z]{1,8}$/.test(token);
};

const rowType = (row: unknown[], columns: Partial<Record<BudgetImportField, number>>): string =>
  normalizeText(rawText(cellAt(row, columns.rowType)) || rawText(row[0]));

const isCategoryRow = (row: unknown[], columns: Partial<Record<BudgetImportField, number>>): boolean => {
  if (categoryNameFromRow(row, columns)) return true;

  const name = rawText(cellAt(row, columns.name));
  const unit = rawText(cellAt(row, columns.unit));
  const amount = rawText(cellAt(row, columns.amount));
  const price = rawText(cellAt(row, columns.unitPrice));
  const code = rawText(cellAt(row, columns.code));
  const type = rowType(row, columns);
  const nonEmpty = row.filter((value) => rawText(value)).length;

  return !!name
    && !unit
    && !amount
    && !price
    && (!code || nonEmpty <= 2 || ["d", "sd", "dil", "oddil", "soubor"].includes(type));
};

const isStructuralRow = (row: unknown[], columns: Partial<Record<BudgetImportField, number>>): boolean => {
  const type = rowType(row, columns);
  if (["online psc", "psc url", "url"].includes(type)) return true;
  if (["pp", "ts", "vv", "psc", "pozn", "poznamka"].includes(type)) return false;

  const values = row.map(rawText).filter(Boolean);
  if (values.length >= 3 && values.every((value) => {
    const parsed = parseImportNumber(value);
    return parsed !== null && Number.isInteger(parsed) && parsed >= 0 && parsed <= 99;
  })) {
    return true;
  }

  return !rawText(cellAt(row, columns.code))
    && !rawText(cellAt(row, columns.name))
    && !rawText(cellAt(row, columns.unit))
    && !rawText(cellAt(row, columns.amount));
};

const detailKindFromRowType = (type: string): { kind: "description" | "measurement"; label: string } | null => {
  if (type === "pp") return { kind: "measurement", label: "Popis položky" };
  if (type === "ts") return { kind: "measurement", label: "Technická specifikace" };
  if (type === "vv") return { kind: "measurement", label: "Výkaz výměr" };
  if (type === "psc") return { kind: "description", label: "Poznámka cenové soustavy" };
  if (["pozn", "poznamka"].includes(type)) return { kind: "description", label: "Poznámka" };
  return null;
};

const shouldSkipTypedNonItemRow = (
  type: string,
  columns: Partial<Record<BudgetImportField, number>>,
): boolean =>
  columns.rowType !== undefined
  && !!type
  && !["p", "k", "m", "d", "sd", "dil", "oddil", "soubor"].includes(type)
  && detailKindFromRowType(type) === null;

const detailText = (row: unknown[], columns: Partial<Record<BudgetImportField, number>>): string => {
  const preferred = rawText(cellAt(row, columns.name));
  if (preferred) return preferred;
  return row.map(rawText).filter(Boolean).slice(1).join(" | ");
};

const detailResult = (row: unknown[], columns: Partial<Record<BudgetImportField, number>>): number => {
  const explicit = parseImportNumber(cellAt(row, columns.amount));
  if (explicit !== null) return explicit;
  for (let index = row.length - 1; index >= 1; index--) {
    const parsed = parseImportNumber(row[index]);
    if (parsed !== null) return parsed;
  }
  return 0;
};

const resolveUnit = (row: unknown[], columns: Partial<Record<BudgetImportField, number>>): string => {
  const explicit = rawText(cellAt(row, columns.unit));
  if (isPlausibleUnit(explicit)) return canonicalUnit(explicit) ?? explicit;

  const excluded = new Set(
    [
      columns.rowType,
      columns.code,
      columns.name,
      columns.amount,
      columns.unitPrice,
      columns.category,
      columns.vatRate,
    ].filter((index): index is number => index !== undefined),
  );
  let fallback: string | null = null;
  for (const [index, value] of row.entries()) {
    if (excluded.has(index)) continue;
    const text = rawText(value);
    if (!isPlausibleUnit(text)) continue;
    const unit = canonicalUnit(text) ?? text;
    if (["ks", "kpl"].includes(unit)) return unit;
    fallback ??= unit;
  }
  return fallback ?? "ks";
};

const resolveCategory = (explicit: string, current: string, code: string): string => {
  const resolved =
    budgetSectionFromLabel(explicit)
    ?? budgetSectionFromLabel(current)
    ?? budgetSectionFromCode(code);

  return resolved || explicit.trim() || current.trim() || "Importované položky";
};

const detectHeader = (rows: unknown[][]) => {
  let best: { rowIndex: number; columns: Partial<Record<BudgetImportField, number>>; score: number } | null = null;

  rows.slice(0, 200).forEach((row, rowIndex) => {
    const columns: Partial<Record<BudgetImportField, number>> = {};
    row.forEach((cell, cellIndex) => {
      const label = normalizeText(cell);
      if (!label) return;

      (Object.keys(FIELD_KEYWORDS) as BudgetImportField[]).forEach((field) => {
        if (columns[field] !== undefined) return;
        const exactMatch = FIELD_KEYWORDS[field].some((keyword) => label === normalizeText(keyword));
        const looseMatch = FIELD_KEYWORDS[field].some((keyword) => label.includes(normalizeText(keyword)));
        if (exactMatch || looseMatch) {
          columns[field] = cellIndex;
        }
      });
    });

    const score = Number(columns.name !== undefined) * 5
      + Number(columns.amount !== undefined) * 2
      + Number(columns.unitPrice !== undefined) * 2
      + Number(columns.code !== undefined) * 3
      + Number(columns.unit !== undefined) * 3
      + Number(columns.category !== undefined)
      + Number(columns.vatRate !== undefined)
      + Number(columns.rowType !== undefined);

    if (
      columns.name !== undefined
      && (columns.unit !== undefined || columns.amount !== undefined || columns.unitPrice !== undefined)
      && score >= 5
      && (!best || score > best.score)
    ) {
      best = { rowIndex, columns, score };
    }
  });

  return best;
};

const cellAt = (row: unknown[], index: number | undefined): unknown =>
  index === undefined ? undefined : row[index];

const applyColumnOverrides = (
  columns: Partial<Record<BudgetImportField, number>>,
  overrides?: BudgetImportColumnOverrides,
): Partial<Record<BudgetImportField, number>> => {
  const next = { ...columns };
  if (!overrides) return next;

  MAPPABLE_FIELDS.forEach((field) => {
    const value = overrides[field];
    if (value === undefined) return;
    if (Number.isInteger(value) && value >= 0) {
      next[field] = value;
      return;
    }
    delete next[field];
  });

  return next;
};

const columnsToLabels = (
  headerRow: unknown[],
  columns: Partial<Record<BudgetImportField, number>>,
): ParsedBudgetImportColumns => {
  const labels: ParsedBudgetImportColumns = {};
  MAPPABLE_FIELDS.forEach((field) => {
    const index = columns[field];
    if (index !== undefined) labels[field] = rawText(headerRow[index]);
  });
  return labels;
};

const columnsToIndices = (
  columns: Partial<Record<BudgetImportField, number>>,
): ParsedBudgetImportColumnIndices => {
  const indices: ParsedBudgetImportColumnIndices = {};
  MAPPABLE_FIELDS.forEach((field) => {
    const index = columns[field];
    if (index !== undefined) indices[field] = index;
  });
  return indices;
};

const rowValuesForReport = (row: unknown[]): string[] =>
  row.map(rawText).filter(Boolean).slice(0, 8).map((value) => value.slice(0, 120));

const pushSkippedRowDetail = (
  target: ParsedBudgetImportSkippedRow[],
  detail: ParsedBudgetImportSkippedRow,
): void => {
  if (target.length >= MAX_SKIPPED_ROW_DETAILS) return;
  target.push(detail);
};

export const parseBudgetWorkbook = (
  workbook: XLSX.WorkBook,
  fileName = "import.xlsx",
  optionsOrMaxRows: number | ParseBudgetWorkbookOptions = MAX_IMPORT_ROWS,
): ParsedBudgetImport => {
  const maxRows = typeof optionsOrMaxRows === "number"
    ? optionsOrMaxRows
    : optionsOrMaxRows.maxRows ?? MAX_IMPORT_ROWS;
  const columnOverrides = typeof optionsOrMaxRows === "number"
    ? undefined
    : optionsOrMaxRows.columnOverrides;
  const rows: ParsedBudgetImportRow[] = [];
  const warnings: string[] = [];
  const skippedRowDetails: ParsedBudgetImportSkippedRow[] = [];
  let mappedColumns: ParsedBudgetImportColumns = {};
  let mappedColumnIndices: ParsedBudgetImportColumnIndices = {};
  let headerRow: string[] = [];
  let headerRowNumber = 0;
  let headerSheetName = "";
  let totalRows = 0;
  let skippedRows = 0;
  const sheetNames = workbook.SheetNames.slice();

  workbook.SheetNames.forEach((sheetName) => {
    if (rows.length >= maxRows) return;
    if (isRecapSheetName(sheetName)) return;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: "",
    });
    const header = detectHeader(sheetRows);
    if (!header || header.columns.name === undefined) {
      warnings.push(`List "${sheetName}" nemá rozpoznatelnou hlavičku rozpočtu.`);
      return;
    }
    const columns = applyColumnOverrides(header.columns, columnOverrides);
    const detectedHeaderRow = sheetRows[header.rowIndex] ?? [];
    if (!headerSheetName) {
      mappedColumns = columnsToLabels(detectedHeaderRow, columns);
      mappedColumnIndices = columnsToIndices(columns);
      headerRow = detectedHeaderRow.map(rawText);
      headerRowNumber = header.rowIndex + 1;
      headerSheetName = sheetName;
    }
    if (columns.name === undefined) {
      warnings.push(`List "${sheetName}" nemá po mapování vybraný sloupec názvu položky.`);
      return;
    }

    let currentCategory = "Importované položky";
    for (let rowIndex = header.rowIndex + 1; rowIndex < sheetRows.length; rowIndex++) {
      if (rows.length >= maxRows) {
        warnings.push(`Import byl omezen na ${maxRows.toLocaleString("cs-CZ")} položek.`);
        break;
      }

      const row = sheetRows[rowIndex];
      totalRows++;

      const type = rowType(row, columns);
      const detail = detailKindFromRowType(type);
      if (detail && rows.length > 0) {
        const last = rows[rows.length - 1];
        const text = detailText(row, columns);
        if (detail.kind === "measurement") {
          last.measurements = [
            ...(last.measurements ?? []),
            {
              note: text || `${detail.label} z řádku ${rowIndex + 1}`,
              formula: null,
              result: type === "vv" ? detailResult(row, columns) : 0,
            },
          ];
        } else if (text) {
          const labeledText = `${detail.label}: ${text}`;
          last.description = [last.description, labeledText].filter(Boolean).join("\n\n");
        }
        continue;
      }

      if (isStructuralRow(row, columns)) {
        continue;
      }

      const name = rawText(cellAt(row, columns.name));
      const positionLabel = positionLabelFromCell(cellAt(row, columns.order));
      const code = rawText(cellAt(row, columns.code));
      const category = rawText(cellAt(row, columns.category));
      const unit = resolveUnit(row, columns);
      const amount = parseImportNumber(cellAt(row, columns.amount)) ?? 0;
      const unitPrice = parseImportNumber(cellAt(row, columns.unitPrice)) ?? 0;

      if (category) currentCategory = category;

      if (!name && !code) {
        skippedRows++;
        pushSkippedRowDetail(skippedRowDetails, {
          sheetName,
          rowNumber: rowIndex + 1,
          reason: "Řádek nemá kód ani název položky.",
          values: rowValuesForReport(row),
        });
        continue;
      }

      if (shouldSkipTypedNonItemRow(type, columns)) {
        skippedRows++;
        pushSkippedRowDetail(skippedRowDetails, {
          sheetName,
          rowNumber: rowIndex + 1,
          reason: `Typ řádku "${rawText(cellAt(row, columns.rowType)) || type}" není položka rozpočtu.`,
          values: rowValuesForReport(row),
        });
        continue;
      }

      if (isCategoryRow(row, columns)) {
        const categoryRowName = categoryNameFromRow(row, columns) ?? name;
        currentCategory = budgetSectionFromLabel(categoryRowName) ?? categoryRowName;
        skippedRows++;
        pushSkippedRowDetail(skippedRowDetails, {
          sheetName,
          rowNumber: rowIndex + 1,
          reason: "Řádek je hlavička kapitoly, ne položka rozpočtu.",
          values: rowValuesForReport(row),
        });
        continue;
      }

      if (!name) {
        skippedRows++;
        pushSkippedRowDetail(skippedRowDetails, {
          sheetName,
          rowNumber: rowIndex + 1,
          reason: "Chybí název položky v rozpoznaném sloupci názvu.",
          values: rowValuesForReport(row),
        });
        continue;
      }

      rows.push({
        sourceRowNumber: rowIndex + 1,
        sheetName,
        categoryName: resolveCategory(category, currentCategory, code),
        positionLabel,
        code,
        name,
        unit,
        amount: amount || 1,
        unitPrice,
        vatRate: parseVatRate(cellAt(row, columns.vatRate)),
        marginPercent: 0,
        description: null,
        measurements: [],
        unitPriceColumnIndex: columns.unitPrice,
      });
    }
  });

  return {
    fileName,
    sheetNames,
    rows,
    totalRows,
    skippedRows,
    skippedRowDetails,
    mappedColumns,
    mappedColumnIndices,
    headerRow,
    headerRowNumber,
    headerSheetName,
    warnings,
  };
};

export const parseBudgetImportFile = async (
  file: File,
  options?: ParseBudgetWorkbookOptions,
): Promise<ParsedBudgetImport> => {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!SUPPORTED_IMPORT_EXTENSIONS.has(extension)) {
    throw new Error("Podporované jsou pouze tabulkové soubory XLSX, XLSM, XLSB, XLS nebo ODS.");
  }
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    throw new Error("Soubor je větší než 50 MB. Z bezpečnostních důvodů import zastaven.");
  }
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
  });
  return parseBudgetWorkbook(workbook, file.name, options);
};

export const formatBudgetImportReport = (
  parsed: Pick<ParsedBudgetImport, "skippedRows">,
  result: ProjectBudgetImportResult,
): string => {
  const skipped = parsed.skippedRows + result.skippedRows;
  const skippedText = skipped > 0 ? ` Neimportováno ${skipped.toLocaleString("cs-CZ")} řádků.` : "";
  return `Naimportováno ${result.itemsAdded.toLocaleString("cs-CZ")} položek, ${result.categoriesAdded.toLocaleString("cs-CZ")} kapitol a ${result.sheetsAdded.toLocaleString("cs-CZ")} listů.${skippedText}`;
};
