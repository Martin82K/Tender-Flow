import type { ContractOverviewRow } from "../api/contractOverviewApi";

export type ContractOverviewParameterKey =
  | "warranty"
  | "warrantyEnd"
  | "retentionShort"
  | "retentionShortRelease"
  | "retentionLong"
  | "retentionLongRelease"
  | "warrantyRetention"
  | "warrantyRetentionRelease"
  | "maturity"
  | "paymentTerms";

export const CONTRACT_OVERVIEW_PARAMETER_LABELS: Record<ContractOverviewParameterKey, string> = {
  warranty: "Záruka",
  warrantyEnd: "Konec záruky",
  retentionShort: "Krátké zádržné",
  retentionShortRelease: "Uvolnění krátké pozastávky",
  retentionLong: "Dlouhé zádržné",
  retentionLongRelease: "Uvolnění dlouhé pozastávky",
  warrantyRetention: "Pozastávka po záruce",
  warrantyRetentionRelease: "Uvolnění po záruce",
  maturity: "Splatnost",
  paymentTerms: "Platební podmínky",
};

export const CONTRACT_OVERVIEW_PARAMETER_KEYS = Object.keys(
  CONTRACT_OVERVIEW_PARAMETER_LABELS,
) as ContractOverviewParameterKey[];

export const CONTRACT_OVERVIEW_STATUS_LABELS = {
  draft: "Návrh",
  active: "Aktivní",
  closed: "Uzavřeno",
} as const;

export interface ContractOverviewFilters {
  query: string;
  projectIds: ReadonlySet<string>;
  statuses: ReadonlySet<string>;
}

export const toggleContractOverviewProject = (
  current: ReadonlySet<string> | null,
  projectId: string,
): Set<string> | null => {
  if (current === null) return new Set([projectId]);
  const next = new Set(current);
  if (next.has(projectId)) next.delete(projectId);
  else next.add(projectId);
  return next.size === 0 ? null : next;
};

const normalizeSearch = (value: string): string => value.trim().toLocaleLowerCase("cs-CZ");

export const getContractOverviewStatusLabel = (status: string): string =>
  CONTRACT_OVERVIEW_STATUS_LABELS[status as keyof typeof CONTRACT_OVERVIEW_STATUS_LABELS] || status;

export const filterContractOverviewRows = (
  rows: ContractOverviewRow[],
  filters: ContractOverviewFilters,
): ContractOverviewRow[] => {
  const query = normalizeSearch(filters.query);
  return rows.filter((row) => {
    if (filters.projectIds.size > 0 && !filters.projectIds.has(row.projectId)) return false;
    if (filters.statuses.size > 0 && !filters.statuses.has(row.contractStatus)) return false;
    if (!query) return true;
    return [
      row.projectName,
      row.contractPartner,
      row.contractTitle,
      row.contractNumber || "",
      ...row.amendments.map((amendment) => `dodatek ${amendment.amendmentNo}`),
    ].some((value) => normalizeSearch(value).includes(query));
  });
};

export const formatContractOverviewDate = (value: string | null): string => {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("cs-CZ").format(date);
};

export const formatContractOverviewPercent = (value: number | null): string =>
  value == null ? "" : `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(value)} %`;
