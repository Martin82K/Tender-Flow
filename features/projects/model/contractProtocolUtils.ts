import type {
  ContractProtocolDefinition,
  ContractProtocolDraft,
} from "./contractProtocolTypes";

const EXCEL_FORMULA_PREFIX = /^\s*[=+\-@]/;

const stripDiacritics = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const sanitizeExcelCellText = (value: string): string => {
  const normalized = value.replace(/\r\n/g, "\n");
  if (EXCEL_FORMULA_PREFIX.test(normalized)) {
    return `'${normalized}`;
  }
  return normalized;
};

export const sanitizeProtocolFileName = (fileName: string): string => {
  const normalized = stripDiacritics(fileName)
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_\.]+|[_\.]+$/g, "");

  const safeBase = (normalized || "predavaci_protokol").toLowerCase();
  return safeBase.endsWith(".xlsx") ? safeBase : `${safeBase}.xlsx`;
};

export const formatCzechDate = (value?: string | Date | null): string => {
  if (!value) return "";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("cs-CZ");
};

export const formatCurrencyCzk = (value?: number | null): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const normalizeDraftFields = (
  raw: Record<string, string>,
): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : "",
    ]),
  );
};

const unique = (values: string[]): string[] => Array.from(new Set(values));

export const buildContractProtocolDraft = (
  definition: ContractProtocolDefinition,
  fields: Record<string, string>,
): ContractProtocolDraft => {
  const normalizedFields = normalizeDraftFields(fields);
  const fieldMeta = Object.fromEntries(
    Object.entries(definition.fieldMeta).map(([key, value]) => [
      key,
      {
        key,
        ...value,
      },
    ]),
  );

  const missingCandidates = unique([
    ...definition.requiredFields,
    ...definition.autofillFields,
  ]);

  const missingFields = missingCandidates.filter(
    (key) => !normalizedFields[key]?.trim(),
  );

  return {
    documentKind: definition.kind,
    actionLabel: definition.actionLabel,
    templateStatus: definition.templateStatus,
    fields: normalizedFields,
    fieldOrder: definition.fieldOrder,
    fieldMeta,
    requiredFields: definition.requiredFields,
    autofillFields: definition.autofillFields,
    manualOnlyFields: definition.manualOnlyFields,
    missingFields,
  };
};

export const applyFieldOverrides = (
  base: Record<string, string>,
  overrides?: Partial<Record<string, string>>,
): Record<string, string> => {
  if (!overrides) return { ...base };

  const next: Record<string, string> = { ...base };
  Object.entries(overrides).forEach(([key, value]) => {
    if (typeof value !== "string") return;
    next[key] = value;
  });

  return next;
};

export const setWorksheetText = (
  worksheet: import("exceljs").Worksheet,
  address: string,
  value: string | undefined,
): void => {
  worksheet.getCell(address).value = sanitizeExcelCellText(value || "");
};
