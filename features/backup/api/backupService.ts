import { dbAdapter } from '@/services/dbAdapter';
import { backupAdapter } from '@/services/platformAdapter';
import type { BackupManifest, RestoreSummary, BackupHistoryEntry } from '../model/backupTypes';

/**
 * Backup service — orchestrates export/restore via Supabase RPC
 * and local file storage via platform adapter (desktop only).
 */
export const backupService = {
    /**
     * Export user backup (all data owned by current user in the org).
     */
    async exportUserBackup(orgId: string): Promise<BackupManifest> {
        const { data, error } = await dbAdapter.rpc<BackupManifest>(
            'export_user_backup',
            { target_org_id: orgId }
        );
        if (error) throw error;
        return data as BackupManifest;
    },

    /**
     * Export tenant backup (all org data, admin/owner only).
     */
    async exportTenantBackup(orgId: string): Promise<BackupManifest> {
        const { data, error } = await dbAdapter.rpc<BackupManifest>(
            'export_tenant_backup',
            { target_org_id: orgId }
        );
        if (error) throw error;
        return data as BackupManifest;
    },

    /**
     * Restore user backup (only overwrites user-owned records).
     */
    async restoreUserBackup(backupJson: BackupManifest, orgId: string): Promise<RestoreSummary> {
        const { data, error } = await dbAdapter.rpc<RestoreSummary>(
            'restore_user_backup',
            { backup_json: backupJson, target_org_id: orgId }
        );
        if (error) throw error;
        return data as RestoreSummary;
    },

    /**
     * Restore tenant backup (all org data, admin/owner only).
     */
    async restoreTenantBackup(backupJson: BackupManifest, orgId: string): Promise<RestoreSummary> {
        const { data, error } = await dbAdapter.rpc<RestoreSummary>(
            'restore_tenant_backup',
            { backup_json: backupJson, target_org_id: orgId }
        );
        if (error) throw error;
        return data as RestoreSummary;
    },

    /**
     * Export and save backup locally (desktop only).
     * Calls RPC, then saves result to local file system.
     */
    async exportAndSaveLocally(
        orgId: string,
        backupType: 'user' | 'tenant'
    ): Promise<{ manifest: BackupManifest; filePath: string }> {
        const manifest = backupType === 'user'
            ? await this.exportUserBackup(orgId)
            : await this.exportTenantBackup(orgId);

        const jsonContent = JSON.stringify(manifest, null, 2);
        const filePath = await backupAdapter.save(jsonContent, backupType, orgId);

        return { manifest, filePath };
    },

    /**
     * Load a backup manifest from local file (desktop only).
     */
    async loadFromLocalFile(filePath: string): Promise<BackupManifest> {
        const content = await backupAdapter.read(filePath);
        const manifest = JSON.parse(content) as BackupManifest;

        if (!manifest.version || !manifest.type) {
            throw new Error('Neplatný formát zálohy: chybí verze nebo typ.');
        }

        return manifest;
    },

    /**
     * Get backup history from database.
     */
    async getBackupHistory(orgId: string): Promise<BackupHistoryEntry[]> {
        const { data, error } = await dbAdapter.from('backup_history')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        return (data ?? []) as BackupHistoryEntry[];
    },
};
