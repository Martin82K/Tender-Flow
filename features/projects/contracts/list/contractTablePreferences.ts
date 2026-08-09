export type ContractColumnId =
  | 'number'
  | 'document'
  | 'vendor'
  | 'status'
  | 'total'
  | 'amendments'
  | 'invoiced'
  | 'paid'
  | 'retentionShort'
  | 'retentionLong'
  | 'warrantyEnd'
  | 'paymentTerms'
  | 'rating';

export const CONTRACT_COLUMN_IDS: ContractColumnId[] = [
  'vendor',
  'number',
  'document',
  'status',
  'total',
  'amendments',
  'invoiced',
  'paid',
  'retentionShort',
  'retentionLong',
  'warrantyEnd',
  'paymentTerms',
  'rating',
];

export const DEFAULT_CONTRACT_COLUMN_WIDTHS: Record<ContractColumnId, number> = {
  number: 280,
  document: 104,
  vendor: 220,
  status: 120,
  total: 150,
  amendments: 145,
  invoiced: 145,
  paid: 145,
  retentionShort: 185,
  retentionLong: 185,
  warrantyEnd: 120,
  paymentTerms: 145,
  rating: 125,
};

const MIN_WIDTHS: Record<ContractColumnId, number> = {
  ...Object.fromEntries(CONTRACT_COLUMN_IDS.map((id) => [id, 100])),
  number: 140,
  document: 84,
} as Record<ContractColumnId, number>;

const MAX_WIDTHS: Record<ContractColumnId, number> = {
  ...Object.fromEntries(CONTRACT_COLUMN_IDS.map((id) => [id, 520])),
  number: 720,
  vendor: 720,
  document: 180,
} as Record<ContractColumnId, number>;

export interface ContractTablePreferences {
  version: 2;
  visibleColumns: ContractColumnId[];
  widths: Record<ContractColumnId, number>;
}

const isColumnId = (value: unknown): value is ContractColumnId =>
  typeof value === 'string' && CONTRACT_COLUMN_IDS.includes(value as ContractColumnId);

export const resizeContractColumn = (column: ContractColumnId, width: number): number => {
  const finiteWidth = Number.isFinite(width) ? width : DEFAULT_CONTRACT_COLUMN_WIDTHS[column];
  return Math.round(Math.min(MAX_WIDTHS[column], Math.max(MIN_WIDTHS[column], finiteWidth)));
};

export const defaultContractTablePreferences = (): ContractTablePreferences => ({
  version: 2,
  visibleColumns: [...CONTRACT_COLUMN_IDS],
  widths: { ...DEFAULT_CONTRACT_COLUMN_WIDTHS },
});

export const parseContractTablePreferences = (
  raw: string | null,
): ContractTablePreferences => {
  const fallback = defaultContractTablePreferences();
  if (!raw) return fallback;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const visibleColumns = parsed.filter(isColumnId);
      return {
        ...fallback,
        visibleColumns: visibleColumns.length > 0 ? visibleColumns : fallback.visibleColumns,
      };
    }
    if (!parsed || typeof parsed !== 'object') return fallback;

    const candidate = parsed as {
      version?: unknown;
      visibleColumns?: unknown;
      widths?: unknown;
    };
    if (candidate.version !== 2) return fallback;

    const visibleColumns = Array.isArray(candidate.visibleColumns)
      ? candidate.visibleColumns.filter(isColumnId)
      : fallback.visibleColumns;
    const rawWidths =
      candidate.widths && typeof candidate.widths === 'object'
        ? (candidate.widths as Record<string, unknown>)
        : {};
    const widths = { ...DEFAULT_CONTRACT_COLUMN_WIDTHS };
    for (const column of CONTRACT_COLUMN_IDS) {
      const width = rawWidths[column];
      if (typeof width === 'number') widths[column] = resizeContractColumn(column, width);
    }

    return {
      version: 2,
      visibleColumns: visibleColumns.length > 0 ? visibleColumns : fallback.visibleColumns,
      widths,
    };
  } catch {
    return fallback;
  }
};
