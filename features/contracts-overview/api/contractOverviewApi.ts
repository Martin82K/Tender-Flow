import { dbAdapter } from "@infra/db/dbAdapter";

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
  warrantyMonths: number | null;
  signedAt: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

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
    currency: String(row.currency || "CZK"),
    basePrice: Number(row.base_price || 0),
    currentTotal: Number(row.current_total || 0),
    approvedDrawdown: Number(row.approved_drawdown || 0),
    remainingAmount: Number(row.remaining_amount || 0),
    retentionPercent: row.retention_percent == null ? null : Number(row.retention_percent),
    warrantyMonths: row.warranty_months == null ? null : Number(row.warranty_months),
    signedAt: row.signed_at ? String(row.signed_at) : null,
    effectiveFrom: row.effective_from ? String(row.effective_from) : null,
    effectiveTo: row.effective_to ? String(row.effective_to) : null,
  }));

export const getContractOverview = async (organizationId: string | null, includeArchived: boolean): Promise<ContractOverviewRow[]> => {
  const { data, error } = await dbAdapter.rpc("get_contract_overview", {
    organization_id_input: organizationId,
    include_archived: includeArchived,
  });
  if (error) throw new Error(error.message);
  return mapContractOverviewRows((data || []) as Array<Record<string, unknown>>);
};
