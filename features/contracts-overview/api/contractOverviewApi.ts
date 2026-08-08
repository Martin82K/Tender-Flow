import { dbAdapter } from "@infra/db/dbAdapter";
import { contractService } from "@/services/contractService";
import { shellAdapter } from "@/services/platformAdapter";

const normalizeCurrencyCode = (currency?: string): string => {
  const upper = currency?.trim().toUpperCase();
  if (!upper || upper === "KČ" || upper === "KC") return "CZK";
  return /^[A-Z]{3}$/.test(upper) ? upper : "CZK";
};

export const formatContractOverviewMoney = (value: number, currency?: string): string =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: normalizeCurrencyCode(currency),
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

export interface ContractOverviewRow {
  organizationId: string;
  projectId: string;
  projectName: string;
  projectStatus: string;
  contractId: string;
  contractPartner: string;
  contractTitle: string;
  contractNumber: string | null;
  contractStatus: string;
  currency: string;
  basePrice: number;
  currentTotal: number;
  approvedDrawdown: number;
  remainingAmount: number;
  retentionPercent: number | null;
  retentionShortPercent: number | null;
  retentionShortAmount: number | null;
  retentionShortReleaseOn: string | null;
  retentionLongPercent: number | null;
  retentionLongAmount: number | null;
  retentionLongReleaseOn: string | null;
  warrantyMonths: number | null;
  warrantyEnd: string | null;
  warrantyRetentionPercent: number | null;
  warrantyRetentionReleaseOn: string | null;
  maturityDays: number | null;
  paymentTerms: string | null;
  signedAt: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  documentUrl: string | null;
  documentStoragePath: string | null;
  documentFileName: string | null;
  amendments: ContractOverviewAmendment[];
}

export interface ContractOverviewAmendment {
  id: string;
  amendmentNo: number;
  status: string | null;
  signedAt: string | null;
  effectiveFrom: string | null;
  deltaPrice: number;
  documentUrl: string | null;
  documentStoragePath: string | null;
  documentFileName: string | null;
}

const nullableString = (value: unknown): string | null =>
  value == null || value === "" ? null : String(value);

const nullableNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const mapAmendments = (value: unknown): ContractOverviewAmendment[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (!row.id) return [];
    return [{
      id: String(row.id),
      amendmentNo: Number(row.amendment_no || 0),
      status: nullableString(row.status),
      signedAt: nullableString(row.signed_at),
      effectiveFrom: nullableString(row.effective_from),
      deltaPrice: Number(row.delta_price || 0),
      documentUrl: nullableString(row.document_url),
      documentStoragePath: nullableString(row.document_storage_path),
      documentFileName: nullableString(row.document_file_name),
    }];
  });
};

export const mapContractOverviewRows = (rows: Array<Record<string, unknown>>): ContractOverviewRow[] =>
  rows.map((row) => ({
    organizationId: String(row.organization_id),
    projectId: String(row.project_id),
    projectName: String(row.project_name),
    projectStatus: String(row.project_status),
    contractId: String(row.contract_id),
    contractPartner: String(row.contract_partner),
    contractTitle: String(row.contract_title),
    contractNumber: row.contract_number ? String(row.contract_number) : null,
    contractStatus: String(row.contract_status),
    currency: normalizeCurrencyCode(String(row.currency || "CZK")),
    basePrice: Number(row.base_price || 0),
    currentTotal: Number(row.current_total || 0),
    approvedDrawdown: Number(row.approved_drawdown || 0),
    remainingAmount: Number(row.remaining_amount || 0),
    retentionPercent: nullableNumber(row.retention_percent),
    retentionShortPercent: nullableNumber(row.retention_short_percent),
    retentionShortAmount: nullableNumber(row.retention_short_amount),
    retentionShortReleaseOn: nullableString(row.retention_short_release_on),
    retentionLongPercent: nullableNumber(row.retention_long_percent),
    retentionLongAmount: nullableNumber(row.retention_long_amount),
    retentionLongReleaseOn: nullableString(row.retention_long_release_on),
    warrantyMonths: nullableNumber(row.warranty_months),
    warrantyEnd: nullableString(row.warranty_end),
    warrantyRetentionPercent: nullableNumber(row.warranty_retention_percent),
    warrantyRetentionReleaseOn: nullableString(row.warranty_retention_release_on),
    maturityDays: nullableNumber(row.maturity_days),
    paymentTerms: nullableString(row.payment_terms),
    signedAt: nullableString(row.signed_at),
    effectiveFrom: nullableString(row.effective_from),
    effectiveTo: nullableString(row.effective_to),
    documentUrl: nullableString(row.document_url),
    documentStoragePath: nullableString(row.document_storage_path),
    documentFileName: nullableString(row.document_file_name),
    amendments: mapAmendments(row.amendments),
  }));

export const getContractOverview = async (organizationId: string | null, includeArchived: boolean): Promise<ContractOverviewRow[]> => {
  const { data, error } = await dbAdapter.rpc("get_contract_overview", {
    organization_id_input: organizationId,
    include_archived: includeArchived,
  });
  if (error) throw new Error(error.message);
  return mapContractOverviewRows((data || []) as Array<Record<string, unknown>>);
};

export const openContractOverviewDocument = async (
  document: Pick<ContractOverviewRow | ContractOverviewAmendment, "documentStoragePath" | "documentUrl">,
  kind: "contract" | "amendment",
): Promise<void> => {
  const url = kind === "contract"
    ? await contractService.getContractDocumentUrl(document)
    : await contractService.getAmendmentDocumentUrl(document);
  await shellAdapter.openExternal(url);
};
