import { ipcMain, shell } from 'electron';
import { getAutoBackupService } from '../../services/autoBackupService';
import type { BackupFileInfo, BackupSettings } from '../../services/autoBackupService';

interface BackupHandlerDependencies {
    requireAuth: (sender: Electron.WebContents, channel?: string) => void;
}

export function registerBackupHandlers({ requireAuth }: BackupHandlerDependencies): void {
    const backupService = getAutoBackupService();

    ipcMain.handle('backup:getSettings', async (event): Promise<BackupSettings> => {
        requireAuth(event.sender, 'backup:getSettings');
        return backupService.getSettings();
    });

    ipcMain.handle('backup:setEnabled', async (event, enabled: boolean): Promise<void> => {
        requireAuth(event.sender, 'backup:setEnabled');
        await backupService.setEnabled(enabled);
    });

    ipcMain.handle('backup:setScheduledTime', async (event, time: string): Promise<void> => {
        requireAuth(event.sender, 'backup:setScheduledTime');
        await backupService.setScheduledTime(time);
    });

    ipcMain.handle(
        'backup:save',
        async (event, jsonContent: string, backupType: 'user' | 'tenant' | 'contacts', organizationId: string): Promise<string> => {
            requireAuth(event.sender, 'backup:save');
            return backupService.saveBackup(jsonContent, backupType, organizationId);
        }
    );

    ipcMain.handle('backup:read', async (event, filePath: string): Promise<string> => {
        requireAuth(event.sender, 'backup:read');
        return backupService.readBackup(filePath);
    });

    ipcMain.handle('backup:list', async (event): Promise<BackupFileInfo[]> => {
        requireAuth(event.sender, 'backup:list');
        return backupService.listBackups();
    });

    ipcMain.handle('backup:getFolder', async (event): Promise<string> => {
        requireAuth(event.sender, 'backup:getFolder');
        return backupService.getBackupFolder();
    });

    ipcMain.handle('backup:openFolder', async (event): Promise<{ success: boolean; error?: string }> => {
        requireAuth(event.sender, 'backup:openFolder');
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

    ipcMain.handle('backup:clean', async (event): Promise<number> => {
        requireAuth(event.sender, 'backup:clean');
        return backupService.cleanOldBackups();
    });
}
