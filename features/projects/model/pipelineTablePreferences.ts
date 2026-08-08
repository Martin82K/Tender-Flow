export const PIPELINE_TABLE_COLUMN_IDS = [
  'status',
  'demand',
  'deadline',
  'realization',
  'price',
  'requested',
  'offers',
  'contracts',
  'actions',
] as const;

export type PipelineTableColumnId = (typeof PIPELINE_TABLE_COLUMN_IDS)[number];
export type ResizablePipelineTableColumnId = Exclude<PipelineTableColumnId, 'actions'>;

export const RESIZABLE_PIPELINE_TABLE_COLUMN_IDS: ResizablePipelineTableColumnId[] = [
  'status',
  'demand',
  'deadline',
  'realization',
  'price',
  'requested',
  'offers',
  'contracts',
];

export const DEFAULT_PIPELINE_TABLE_COLUMN_WIDTHS: Record<PipelineTableColumnId, number> = {
  status: 110,
  demand: 320,
  deadline: 120,
  realization: 240,
  price: 110,
  requested: 90,
  offers: 60,
  contracts: 90,
  actions: 72,
};

export const MIN_PIPELINE_TABLE_COLUMN_WIDTHS: Record<ResizablePipelineTableColumnId, number> = {
  status: 96,
  demand: 180,
  deadline: 100,
  realization: 180,
  price: 100,
  requested: 80,
  offers: 56,
  contracts: 80,
};

export const MAX_PIPELINE_TABLE_COLUMN_WIDTHS: Record<ResizablePipelineTableColumnId, number> = {
  status: 180,
  demand: 560,
  deadline: 180,
  realization: 420,
  price: 180,
  requested: 140,
  offers: 110,
  contracts: 140,
};

export interface PipelineTablePreferences {
  version: 1;
  widths: Record<ResizablePipelineTableColumnId, number>;
}

const defaultResizableWidths = (): Record<ResizablePipelineTableColumnId, number> => ({
  status: DEFAULT_PIPELINE_TABLE_COLUMN_WIDTHS.status,
  demand: DEFAULT_PIPELINE_TABLE_COLUMN_WIDTHS.demand,
  deadline: DEFAULT_PIPELINE_TABLE_COLUMN_WIDTHS.deadline,
  realization: DEFAULT_PIPELINE_TABLE_COLUMN_WIDTHS.realization,
  price: DEFAULT_PIPELINE_TABLE_COLUMN_WIDTHS.price,
  requested: DEFAULT_PIPELINE_TABLE_COLUMN_WIDTHS.requested,
  offers: DEFAULT_PIPELINE_TABLE_COLUMN_WIDTHS.offers,
  contracts: DEFAULT_PIPELINE_TABLE_COLUMN_WIDTHS.contracts,
});

export const resizePipelineTableColumn = (
  column: ResizablePipelineTableColumnId,
  width: number,
): number => {
  const finiteWidth = Number.isFinite(width)
    ? width
    : DEFAULT_PIPELINE_TABLE_COLUMN_WIDTHS[column];
  return Math.round(
    Math.min(
      MAX_PIPELINE_TABLE_COLUMN_WIDTHS[column],
      Math.max(MIN_PIPELINE_TABLE_COLUMN_WIDTHS[column], finiteWidth),
    ),
  );
};

export const defaultPipelineTablePreferences = (): PipelineTablePreferences => ({
  version: 1,
  widths: defaultResizableWidths(),
});

export const parsePipelineTablePreferences = (raw: string | null): PipelineTablePreferences => {
  const fallback = defaultPipelineTablePreferences();
  if (!raw) return fallback;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;

    const candidate = parsed as { version?: unknown; widths?: unknown };
    if (candidate.version !== 1 || !candidate.widths || typeof candidate.widths !== 'object') {
      return fallback;
    }

    const rawWidths = candidate.widths as Record<string, unknown>;
    const widths = defaultResizableWidths();
    for (const column of RESIZABLE_PIPELINE_TABLE_COLUMN_IDS) {
      const width = rawWidths[column];
      if (typeof width === 'number') {
        widths[column] = resizePipelineTableColumn(column, width);
      }
    }

    return { version: 1, widths };
  } catch {
    return fallback;
  }
};

export const getPipelineTableStorageKey = (userId: string): string =>
  `tf.pipeline.tableColumns.v1.${encodeURIComponent(userId)}`;
