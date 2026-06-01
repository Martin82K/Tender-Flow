import type { Contract, ContractExtractionResult } from '@/types';

const ALLOWED_CURRENCIES = new Set(['CZK', 'EUR', 'USD']);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type ContractUpdateField = keyof Pick<
  Contract,
  | 'title'
  | 'contractNumber'
  | 'vendorName'
  | 'vendorIco'
  | 'signedAt'
  | 'effectiveFrom'
  | 'effectiveTo'
  | 'completionDate'
  | 'basePrice'
  | 'currency'
  | 'retentionShortPercent'
  | 'retentionLongPercent'
  | 'retentionPercent'
  | 'siteSetupPercent'
  | 'warrantyMonths'
  | 'paymentTerms'
  | 'scopeSummary'
>;

export interface ContractOcrUpdateResult {
  updates: Partial<Contract>;
  appliedFields: ContractUpdateField[];
}

const getRuntimeFields = (
  result: Pick<ContractExtractionResult, 'fields'>,
): Record<string, unknown> => {
  if (!result.fields || typeof result.fields !== 'object') return {};
  return result.fields as Record<string, unknown>;
};

const cleanText = (value: unknown, maxLength: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, maxLength);
};

const normalizeIco = (value: unknown): string | undefined => {
  const source =
    typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const digits = source.replace(/\D/g, '');
  return digits.length === 8 ? digits : undefined;
};

const normalizeDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!ISO_DATE_RE.test(trimmed)) return undefined;

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10) === trimmed ? trimmed : undefined;
};

const normalizePositiveNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return value;
};

const normalizePercent = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < 0 || value > 100) return undefined;
  return value;
};

const normalizeInteger = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < 0) return undefined;
  return Math.round(value);
};

const assign = <K extends ContractUpdateField>(
  updates: Partial<Contract>,
  appliedFields: ContractUpdateField[],
  key: K,
  value: Contract[K] | undefined,
) => {
  if (value === undefined) return;
  updates[key] = value;
  appliedFields.push(key);
};

export const buildContractUpdateFromOcr = (
  result: Pick<ContractExtractionResult, 'fields'>,
): ContractOcrUpdateResult => {
  const fields = getRuntimeFields(result);
  const updates: Partial<Contract> = {};
  const appliedFields: ContractUpdateField[] = [];

  assign(updates, appliedFields, 'title', cleanText(fields.title, 250));
  assign(
    updates,
    appliedFields,
    'contractNumber',
    cleanText(fields.contractNumber, 120),
  );
  assign(updates, appliedFields, 'vendorName', cleanText(fields.vendorName, 250));
  assign(updates, appliedFields, 'vendorIco', normalizeIco(fields.vendorIco));
  assign(updates, appliedFields, 'signedAt', normalizeDate(fields.signedAt));
  assign(
    updates,
    appliedFields,
    'effectiveFrom',
    normalizeDate(fields.effectiveFrom),
  );
  assign(updates, appliedFields, 'effectiveTo', normalizeDate(fields.effectiveTo));
  assign(
    updates,
    appliedFields,
    'completionDate',
    normalizeDate(fields.completionDate) ?? normalizeDate(fields.effectiveTo),
  );

  const basePrice = normalizePositiveNumber(fields.basePrice);
  assign(updates, appliedFields, 'basePrice', basePrice);

  const currency =
    typeof fields.currency === 'string'
      ? fields.currency.trim().toUpperCase()
      : undefined;
  assign(
    updates,
    appliedFields,
    'currency',
    currency && ALLOWED_CURRENCIES.has(currency) ? currency : undefined,
  );

  assign(
    updates,
    appliedFields,
    'retentionShortPercent',
    normalizePercent(fields.retentionShortPercent),
  );
  assign(
    updates,
    appliedFields,
    'retentionLongPercent',
    normalizePercent(fields.retentionLongPercent),
  );
  assign(
    updates,
    appliedFields,
    'retentionPercent',
    normalizePercent(fields.retentionPercent),
  );
  assign(
    updates,
    appliedFields,
    'siteSetupPercent',
    normalizePercent(fields.siteSetupPercent),
  );
  assign(
    updates,
    appliedFields,
    'warrantyMonths',
    normalizeInteger(fields.warrantyMonths),
  );
  assign(updates, appliedFields, 'paymentTerms', cleanText(fields.paymentTerms, 500));
  assign(updates, appliedFields, 'scopeSummary', cleanText(fields.scopeSummary, 2_000));

  return { updates, appliedFields };
};
