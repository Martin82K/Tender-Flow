import type {
  ContractSummaryDto,
  ContractSummaryFilters,
  ContractSummarySort,
  ContractWithDetails,
} from "@/types";

const normalize = (value: string | null | undefined): string =>
  (value || "").trim().toLocaleLowerCase("cs");

const normalizeCurrencyCode = (currency?: string): string => {
  const trimmed = currency?.trim();
  if (!trimmed) return "CZK";

  const upper = trimmed.toUpperCase();
  if (upper === "KČ" || upper === "KC" || upper === "CZK") {
    return "CZK";
  }

  if (/^[A-Z]{3}$/.test(upper)) {
    return upper;
  }

  return "CZK";
};

export const formatContractSummaryMoney = (
  value: number,
  currency: string = "CZK",
): string =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: normalizeCurrencyCode(currency),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export const formatContractSummaryDate = (value?: string): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("cs-CZ");
};

export const formatContractSummaryRetention = (
  contract: Pick<ContractSummaryDto, "retentionPercent" | "retentionAmount" | "currency">,
): string => {
  if (typeof contract.retentionPercent === "number") {
    return `${contract.retentionPercent} %`;
  }
  if (typeof contract.retentionAmount === "number") {
    return formatContractSummaryMoney(contract.retentionAmount, contract.currency);
  }
  return "-";
};

export const formatContractSummarySiteSetup = (
  value?: number,
): string => (typeof value === "number" ? `${value} %` : "-");

export const formatContractSummaryWarranty = (
  value?: number,
): string => (typeof value === "number" ? `${value} měs.` : "-");

export const formatContractSummaryPaymentTerms = (
  value?: string,
): string => value?.trim() || "-";

export const getContractSummaryStatusLabel = (
  status: ContractSummaryDto["status"],
): string => {
  const labels: Record<ContractSummaryDto["status"], string> = {
    draft: "Rozpracováno",
    active: "Aktivní",
    closed: "Uzavřeno",
    cancelled: "Zrušeno",
  };

  return labels[status];
};

export const mapContractWithDetailsToSummaryDto = (
  contract: ContractWithDetails,
): ContractSummaryDto => ({
  id: contract.id,
  projectId: contract.projectId,
  title: contract.title,
  contractNumber: contract.contractNumber,
  vendorName: contract.vendorName,
  status: contract.status,
  currency: contract.currency,
  basePrice: contract.basePrice,
  currentTotal: contract.currentTotal,
  approvedSum: contract.approvedSum,
  remaining: contract.remaining,
  retentionPercent: contract.retentionPercent,
  retentionAmount: contract.retentionAmount,
  siteSetupPercent: contract.siteSetupPercent,
  warrantyMonths: contract.warrantyMonths,
  paymentTerms: contract.paymentTerms,
  signedAt: contract.signedAt,
  effectiveFrom: contract.effectiveFrom,
  effectiveTo: contract.effectiveTo,
  completionDate: contract.completionDate,
  scopeSummary: contract.scopeSummary,
});

const matchesContractSummaryFilters = (
  contract: ContractSummaryDto,
  filters: ContractSummaryFilters,
): boolean => {
  const normalizedQuery = normalize(filters.query);
  const matchesQuery =
    !normalizedQuery ||
    normalize(contract.contractNumber).includes(normalizedQuery) ||
    normalize(contract.vendorName).includes(normalizedQuery) ||
    normalize(contract.title).includes(normalizedQuery);

  const matchesStatus =
    !filters.status || filters.status === "all" || contract.status === filters.status;

  return matchesQuery && matchesStatus;
};

export const sortContractSummaryList = (
  contracts: ContractSummaryDto[],
  sort: ContractSummarySort = "vendor_asc",
): ContractSummaryDto[] => {
  const copy = [...contracts];
  if (sort === "vendor_asc") {
    copy.sort(
      (a, b) =>
        normalize(a.vendorName).localeCompare(normalize(b.vendorName), "cs", {
          sensitivity: "base",
        }) ||
        normalize(a.title).localeCompare(normalize(b.title), "cs", {
          sensitivity: "base",
        }) ||
        (a.contractNumber || "").localeCompare(b.contractNumber || "", "cs", {
          sensitivity: "base",
        }),
    );
  }
  return copy;
};

export const filterAndSortContractSummaryList = (
  contracts: ContractSummaryDto[],
  filters: ContractSummaryFilters = {},
  sort: ContractSummarySort = "vendor_asc",
): ContractSummaryDto[] =>
  sortContractSummaryList(
    contracts.filter((contract) => matchesContractSummaryFilters(contract, filters)),
    sort,
  );

export const buildContractSummaryList = (
  contracts: ContractWithDetails[],
  filters: ContractSummaryFilters = {},
  sort: ContractSummarySort = "vendor_asc",
): ContractSummaryDto[] =>
  filterAndSortContractSummaryList(
    contracts.map(mapContractWithDetailsToSummaryDto),
    filters,
    sort,
  );
