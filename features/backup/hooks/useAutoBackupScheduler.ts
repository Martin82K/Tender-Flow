import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { backupAdapter } from '@/services/platformAdapter';
import { backupService } from '../api/backupService';

const CHECK_INTERVAL_MS = 60_000;

/**
 * Renderer-side scheduler for automatic user backups.
 *
 * Runs only while the desktop application window is open and the user is
 * authenticated. On each tick it reads settings from the main process and
 * triggers a user-scoped backup when the configured time has passed and no
 * backup has been written on/after today's scheduled time.
 */
export const useAutoBackupScheduler = (): void => {
    const { user, isAuthenticated } = useAuth();
    const orgId = user?.organizationId;
    const runningRef = useRef(false);

    useEffect(() => {
        if (!isAuthenticated || !orgId) return;
        if (!backupAdapter.isAvailable()) return;

        let cancelled = false;

        const tick = async (): Promise<void> => {
            if (cancelled || runningRef.current) return;

            let settings;
            try {
                settings = await backupAdapter.getSettings();
            } catch (error) {
                console.error('[AutoBackupScheduler] Failed to read settings:', error);
                return;
            }

            if (!settings.enabled) return;

            const scheduledTime = typeof settings.scheduledTime === 'string' && settings.scheduledTime
                ? settings.scheduledTime
                : '03:00';
            const [hours, minutes] = scheduledTime.split(':').map(Number);
            if (Number.isNaN(hours) || Number.isNaN(minutes)) return;

            const now = new Date();
            const scheduledToday = new Date(now);
            scheduledToday.setHours(hours, minutes, 0, 0);

            if (now.getTime() < scheduledToday.getTime()) return;

            if (settings.lastBackupAt) {
                const last = new Date(settings.lastBackupAt).getTime();
                if (!Number.isNaN(last) && last >= scheduledToday.getTime()) return;
            }

            runningRef.current = true;
            try {
                await backupService.exportAndSaveLocally(orgId, 'user');
                console.log('[AutoBackupScheduler] Scheduled backup completed');
            } catch (error) {
                console.error('[AutoBackupScheduler] Scheduled backup failed:', error);
            } finally {
                runningRef.current = false;
            }
        };

        void tick();
        const interval = setInterval(() => void tick(), CHECK_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [isAuthenticated, orgId]);
};
