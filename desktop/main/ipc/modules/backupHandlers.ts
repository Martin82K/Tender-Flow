import { ipcMain, shell } from 'electron';
import { getAutoBackupService } from '../../services/autoBackupService';
import type { BackupFileInfo, BackupSettings } from '../../services/autoBackupService';

export function registerBackupHandlers(): void {
    const backupService = getAutoBackupService();

    ipcMain.handle('backup:getSettings', async (): Promise<BackupSettings> => {
        return backupService.getSettings();
    });

    ipcMain.handle('backup:setEnabled', async (_, enabled: boolean): Promise<void> => {
        await backupService.setEnabled(enabled);
    });

    ipcMain.handle(
        'backup:save',
        async (_, jsonContent: string, backupType: 'user' | 'tenant', organizationId: string): Promise<string> => {
            return backupService.saveBackup(jsonContent, backupType, organizationId);
        }
    );

    ipcMain.handle('backup:read', async (_, filePath: string): Promise<string> => {
        return backupService.readBackup(filePath);
    });

    ipcMain.handle('backup:list', async (): Promise<BackupFileInfo[]> => {
        return backupService.listBackups();
    });

    ipcMain.handle('backup:getFolder', async (): Promise<string> => {
        return backupService.getBackupFolder();
    });

    ipcMain.handle('backup:openFolder', async (): Promise<{ success: boolean; error?: string }> => {
        try {
            const folderPath = backupService.getBackupFolder();
            await shell.openPath(folderPath);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to open folder',
            };
        }
    });

    ipcMain.handle('backup:clean', async (): Promise<number> => {
        return backupService.cleanOldBackups();
    });
}
