export type BackupType = 'user' | 'tenant' | 'contacts';

export interface BackupManifest {
    version: string;
    type: 'user' | 'tenant';
    exported_at: string;
    user_id: string;
    organization_id: string;
    projects: unknown[];
    project_contracts: unknown[];
    project_investor_financials: unknown[];
    project_amendments: unknown[];
    demand_categories: unknown[];
    bids: unknown[];
    bid_tags: unknown[];
    subcontractors: unknown[];
    subcontractor_statuses: unknown[];
    tender_plans: unknown[];
    contracts: unknown[];
    contract_amendments: unknown[];
    contract_drawdowns: unknown[];
}

export interface RestoreSummary {
    success: boolean;
    restored_projects: number;
    restored_demand_categories: number;
    restored_bids: number;
    restored_bid_tags: number;
    restored_subcontractors: number;
    restored_subcontractor_statuses: number;
    restored_tender_plans: number;
    restored_contracts: number;
    restored_contract_amendments: number;
    restored_contract_drawdowns: number;
    restored_project_contracts: number;
    restored_project_investor_financials: number;
    restored_project_amendments: number;
}

export interface ContactsBackupManifest {
    version: string;
    type: 'contacts';
    exported_at: string;
    user_id: string;
    organization_id: string;
    subcontractors: unknown[];
    subcontractor_statuses: unknown[];
}

export type AnyBackupManifest = BackupManifest | ContactsBackupManifest;

export interface BackupHistoryEntry {
    id: string;
    user_id: string;
    organization_id: string;
    backup_type: BackupType;
    storage_path: string | null;
    record_counts: Record<string, number> | null;
    backup_size_bytes: number | null;
    created_at: string;
}

export function getManifestRecordCounts(manifest: AnyBackupManifest): Record<string, number> {
    if (manifest.type === 'contacts') {
        return {
            subcontractors: manifest.subcontractors?.length ?? 0,
            subcontractor_statuses: manifest.subcontractor_statuses?.length ?? 0,
        };
    }
    return {
        projects: manifest.projects?.length ?? 0,
        demand_categories: manifest.demand_categories?.length ?? 0,
        bids: manifest.bids?.length ?? 0,
        subcontractors: manifest.subcontractors?.length ?? 0,
        contracts: manifest.contracts?.length ?? 0,
        tender_plans: manifest.tender_plans?.length ?? 0,
        project_contracts: manifest.project_contracts?.length ?? 0,
        project_amendments: manifest.project_amendments?.length ?? 0,
        contract_amendments: manifest.contract_amendments?.length ?? 0,
        contract_drawdowns: manifest.contract_drawdowns?.length ?? 0,
    };
}
