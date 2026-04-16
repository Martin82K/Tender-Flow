import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { backupService } from '../api/backupService';
import { backupAdapter } from '@/services/platformAdapter';
import { getManifestRecordCounts } from '../model/backupTypes';
import type { AnyBackupManifest, RestoreSummary } from '../model/backupTypes';
import type { BackupFileEntry, BackupSettingsInfo } from '@/shared/types/desktop';
import { useFeatures } from '@/context/FeatureContext';
import { FEATURES } from '@/config/features';

export const BackupSettings: React.FC = () => {
    const { user } = useAuth();
    const { hasFeature } = useFeatures();
    const canBackup = hasFeature(FEATURES.DATA_BACKUP);
    const canTenantBackup = hasFeature(FEATURES.DATA_BACKUP_TENANT);

    const [settings, setSettings] = useState<BackupSettingsInfo | null>(null);
    const [backups, setBackups] = useState<BackupFileEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [restorePreview, setRestorePreview] = useState<{
        manifest: AnyBackupManifest;
        filePath: string;
        counts: Record<string, number>;
    } | null>(null);
    const [restoreResult, setRestoreResult] = useState<RestoreSummary | null>(null);

    const orgId = user?.organizationId;
    const isOrgAdmin = user?.role === 'admin';
    const backupAvailable = backupAdapter.isAvailable();

    const loadData = useCallback(async () => {
        if (!backupAvailable) return;
        try {
            const [s, b] = await Promise.all([
                backupAdapter.getSettings(),
                backupAdapter.list(),
            ]);
            setSettings(s);
            setBackups(b);
        } catch (e) {
            console.error('[Backup] Failed to load settings:', e);
        }
    }, [backupAvailable]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleToggleAutoBackup = async () => {
        if (!settings || !backupAvailable) return;
        try {
            await backupAdapter.setEnabled(!settings.enabled);
            await loadData();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Chyba nastavení');
        }
    };

    const handleChangeScheduledTime = async (time: string) => {
        if (!settings || !backupAvailable) return;
        // Optimistic update so the input reflects the change immediately.
        setSettings({ ...settings, scheduledTime: time });
        try {
            await backupAdapter.setScheduledTime(time);
            await loadData();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Nepodařilo se uložit čas zálohy');
            await loadData();
        }
    };

    const parseScheduledTime = (raw: string | undefined): { hours: number; minutes: number } => {
        const fallback = { hours: 3, minutes: 0 };
        if (!raw) return fallback;
        const [h, m] = raw.split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return fallback;
        return { hours: h, minutes: m };
    };

    const formatScheduledTime = (hours: number, minutes: number): string =>
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    const handleExport = async (type: 'user' | 'tenant') => {
        if (!orgId) return;
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            if (backupAvailable) {
                const { filePath } = await backupService.exportAndSaveLocally(orgId, type);
                setSuccess(`Záloha uložena: ${filePath}`);
                await loadData();
            } else {
                // Fallback: download via browser
                await handleWebExport(type);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Export selhal');
        } finally {
            setLoading(false);
        }
    };

    const handleWebExport = async (type: 'user' | 'tenant') => {
        if (!orgId) return;
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const manifest = type === 'user'
                ? await backupService.exportUserBackup(orgId)
                : await backupService.exportTenantBackup(orgId);
            const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const date = new Date().toISOString().slice(0, 10);
            a.download = `backup-${type}-${orgId}-${date}.json`;
            a.click();
            URL.revokeObjectURL(url);
            setSuccess('Záloha stažena');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Export selhal');
        } finally {
            setLoading(false);
        }
    };

    const handleContactsExport = async () => {
        if (!orgId || !user?.id) return;
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            if (backupAvailable) {
                const { filePath } = await backupService.exportContactsAndSaveLocally(orgId, user.id);
                setSuccess(`Záloha kontaktů uložena: ${filePath}`);
                await loadData();
            } else {
                const manifest = await backupService.exportContactsBackup(orgId, user.id);
                const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const date = new Date().toISOString().slice(0, 10);
                a.download = `backup-contacts-${orgId}-${date}.json`;
                a.click();
                URL.revokeObjectURL(url);
                setSuccess('Záloha kontaktů stažena');
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Export kontaktů selhal');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectRestore = async (filePath: string) => {
        try {
            const manifest = await backupService.loadFromLocalFile(filePath);
            const counts = getManifestRecordCounts(manifest);
            setRestorePreview({ manifest, filePath, counts });
            setRestoreResult(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Nepodařilo se načíst zálohu');
        }
    };

    const handleWebRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const manifest = JSON.parse(text) as AnyBackupManifest;
            if (!manifest.version || !manifest.type) {
                throw new Error('Neplatný formát zálohy');
            }
            const counts = getManifestRecordCounts(manifest);
            setRestorePreview({ manifest, filePath: file.name, counts });
            setRestoreResult(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nepodařilo se načíst soubor');
        }
    };

    const handleConfirmRestore = async () => {
        if (!restorePreview || !orgId) return;
        if (restorePreview.manifest.type === 'contacts') {
            setError('Obnova zálohy kontaktů není podporována. Kontakty lze pouze exportovat.');
            return;
        }
        setRestoring(true);
        setError(null);
        try {
            const result = restorePreview.manifest.type === 'tenant' && canTenantBackup
                ? await backupService.restoreTenantBackup(restorePreview.manifest, orgId)
                : await backupService.restoreUserBackup(restorePreview.manifest, orgId);
            setRestoreResult(result);
            setRestorePreview(null);
            setSuccess('Obnova dat dokončena');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Obnova selhala');
        } finally {
            setRestoring(false);
        }
    };

    const handleOpenFolder = async () => {
        if (backupAvailable) {
            await backupAdapter.openFolder();
        } else {
            setSuccess('Na webu se zálohy ukládají do složky pro stahování vašeho prohlížeče.');
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('cs-CZ');
    };

    if (!canBackup) {
        return (
            <section className="space-y-6">
                <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-500">backup</span>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Záloha a obnova</h2>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">Tato funkce je dostupná od tarifu PRO.</p>
                </div>
            </section>
        );
    }

    return (
        <section className="space-y-6">
            {/* Header */}
            <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-500">backup</span>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Záloha a obnova dat</h2>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                    {backupAvailable
                        ? 'Zálohujte svá data lokálně a obnovte je kdykoliv.'
                        : 'Stáhněte zálohu nebo nahrajte soubor pro obnovu.'}
                </p>
            </div>

            {/* Status messages */}
            {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
                    {error}
                    <button onClick={() => setError(null)} className="ml-2 underline">Zavřít</button>
                </div>
            )}
            {success && (
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg p-4 text-sm text-emerald-700 dark:text-emerald-400">
                    {success}
                    <button onClick={() => setSuccess(null)} className="ml-2 underline">Zavřít</button>
                </div>
            )}

            {/* Auto-backup toggle (desktop only) */}
            {backupAvailable && settings && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-500">schedule</span>
                                Automatická záloha
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                Automaticky zálohovat data 1x denně. Zálohy se ukládají do: <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded">{settings.backupFolderPath}</code>
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                Složka je mimo instalační adresář, takže zálohy přežijí aktualizaci i odinstalaci aplikace.
                            </p>
                            {settings.lastBackupAt && (
                                <p className="text-xs text-slate-400 mt-1">
                                    Poslední záloha: {formatDate(settings.lastBackupAt)}
                                </p>
                            )}
                            {settings.lastBackupError && (
                                <p className="text-xs text-red-500 mt-1">
                                    Chyba: {settings.lastBackupError}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={handleToggleAutoBackup}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                settings.enabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    settings.enabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50 flex flex-wrap items-center gap-3">
                        <label className="text-sm text-slate-700 dark:text-slate-300">
                            Čas spuštění zálohy
                        </label>
                        {(() => {
                            const { hours, minutes } = parseScheduledTime(settings.scheduledTime);
                            const disabled = !settings.enabled;
                            return (
                                <div
                                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
                                        disabled
                                            ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-60'
                                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary'
                                    }`}
                                >
                                    <span
                                        className="material-symbols-outlined fill text-primary"
                                        style={{ fontSize: '20px' }}
                                        aria-hidden="true"
                                    >
                                        schedule
                                    </span>
                                    <select
                                        aria-label="Hodina zálohy"
                                        value={hours}
                                        onChange={(e) =>
                                            void handleChangeScheduledTime(
                                                formatScheduledTime(Number(e.target.value), minutes),
                                            )
                                        }
                                        disabled={disabled}
                                        className="bg-transparent text-sm font-medium text-slate-900 dark:text-white focus:outline-none cursor-pointer disabled:cursor-not-allowed tabular-nums"
                                    >
                                        {Array.from({ length: 24 }, (_, i) => (
                                            <option key={i} value={i} className="bg-white dark:bg-slate-800">
                                                {String(i).padStart(2, '0')}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="text-slate-400 font-medium">:</span>
                                    <select
                                        aria-label="Minuta zálohy"
                                        value={minutes}
                                        onChange={(e) =>
                                            void handleChangeScheduledTime(
                                                formatScheduledTime(hours, Number(e.target.value)),
                                            )
                                        }
                                        disabled={disabled}
                                        className="bg-transparent text-sm font-medium text-slate-900 dark:text-white focus:outline-none cursor-pointer disabled:cursor-not-allowed tabular-nums"
                                    >
                                        {Array.from(
                                            new Set([
                                                ...Array.from({ length: 12 }, (_, i) => i * 5),
                                                minutes,
                                            ]),
                                        )
                                            .sort((a, b) => a - b)
                                            .map((m) => (
                                                <option key={m} value={m} className="bg-white dark:bg-slate-800">
                                                    {String(m).padStart(2, '0')}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            );
                        })()}
                        <span className="text-xs text-slate-400">
                            Záloha se spustí v tento čas každý den. Vyžaduje spuštěnou aplikaci.
                        </span>
                    </div>
                </div>
            )}

            {/* Export section */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500">download</span>
                    Exportovat zálohu
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                    Vytvořte zálohu svých dat. Přepisují se pouze záznamy, kde jste vlastníkem.
                </p>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => handleExport('user')}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 rounded-lg font-medium border border-blue-200 dark:border-blue-500/20 transition-all hover:shadow-sm disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined">person</span>
                        {loading ? 'Zálohování...' : 'Zálohovat moje data'}
                    </button>

                    {canTenantBackup && isOrgAdmin && (
                        <button
                            onClick={() => handleExport('tenant')}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 dark:hover:bg-purple-500/20 rounded-lg font-medium border border-purple-200 dark:border-purple-500/20 transition-all hover:shadow-sm disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined">corporate_fare</span>
                            {loading ? 'Zálohování...' : 'Zálohovat organizaci'}
                        </button>
                    )}

                    <button
                        onClick={handleContactsExport}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400 dark:hover:bg-teal-500/20 rounded-lg font-medium border border-teal-200 dark:border-teal-500/20 transition-all hover:shadow-sm disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined">contacts</span>
                        {loading ? 'Zálohování...' : 'Zálohovat kontakty'}
                    </button>

                    <button
                        onClick={handleOpenFolder}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/50 rounded-lg font-medium border border-slate-200 dark:border-slate-700 transition-all hover:shadow-sm"
                    >
                        <span className="material-symbols-outlined">folder_open</span>
                        Otevřít složku záloh
                    </button>
                </div>
            </div>

            {/* Backup list (desktop) */}
            {backupAvailable && backups.length > 0 && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-500">history</span>
                        Lokální zálohy
                    </h3>
                    <p className="text-xs text-slate-400 mb-3">Zálohy starší než 7 dní se automaticky mažou.</p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                    <th className="text-left py-2 px-3 text-slate-500 font-medium">Soubor</th>
                                    <th className="text-left py-2 px-3 text-slate-500 font-medium">Typ</th>
                                    <th className="text-left py-2 px-3 text-slate-500 font-medium">Datum</th>
                                    <th className="text-right py-2 px-3 text-slate-500 font-medium">Velikost</th>
                                    <th className="text-right py-2 px-3 text-slate-500 font-medium"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {backups.map((b) => (
                                    <tr key={b.filePath} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/25">
                                        <td className="py-2 px-3 font-mono text-xs">{b.fileName}</td>
                                        <td className="py-2 px-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                b.backupType === 'tenant'
                                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400'
                                                    : b.backupType === 'contacts'
                                                    ? 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400'
                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                                            }`}>
                                                {b.backupType === 'tenant' ? 'Organizace' : b.backupType === 'contacts' ? 'Kontakty' : 'Uživatel'}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-slate-500">{formatDate(b.createdAt)}</td>
                                        <td className="py-2 px-3 text-right text-slate-500">{formatBytes(b.sizeBytes)}</td>
                                        <td className="py-2 px-3 text-right">
                                            {b.backupType !== 'contacts' && (
                                                <button
                                                    onClick={() => handleSelectRestore(b.filePath)}
                                                    className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                                                >
                                                    Obnovit
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Restore section */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-500">restore</span>
                    Obnovit data ze zálohy
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                    Obnova přepíše pouze záznamy, kde jste vlastníkem. Ostatní data v organizaci zůstanou nedotčena.
                </p>

                {!backupAvailable && (
                    <div className="mb-4">
                        <label className="flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20 rounded-lg font-medium border border-amber-200 dark:border-amber-500/20 cursor-pointer transition-all hover:shadow-sm w-fit">
                            <span className="material-symbols-outlined">upload_file</span>
                            Nahrát soubor zálohy (.json)
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleWebRestore}
                                className="hidden"
                            />
                        </label>
                    </div>
                )}

                {/* Restore preview */}
                {restorePreview && (
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-4 space-y-3">
                        <p className="font-medium text-amber-800 dark:text-amber-300">
                            Připraveno k obnově: {restorePreview.filePath.split(/[\\/]/).pop()}
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-400">
                            Typ: {restorePreview.manifest.type === 'tenant' ? 'Organizace' : 'Uživatel'} |
                            Vytvořeno: {formatDate(restorePreview.manifest.exported_at)}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                            {Object.entries(restorePreview.counts)
                                .filter(([, v]) => (v as number) > 0)
                                .map(([key, value]) => (
                                    <div key={key} className="flex justify-between bg-white dark:bg-slate-800 rounded px-3 py-1">
                                        <span className="text-slate-500">{key.replace(/_/g, ' ')}</span>
                                        <span className="font-medium">{value}</span>
                                    </div>
                                ))}
                        </div>
                        <div className="flex gap-3 mt-3">
                            <button
                                onClick={handleConfirmRestore}
                                disabled={restoring}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-all disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined">restore</span>
                                {restoring ? 'Obnovuji...' : 'Potvrdit obnovu'}
                            </button>
                            <button
                                onClick={() => setRestorePreview(null)}
                                className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                            >
                                Zrušit
                            </button>
                        </div>
                    </div>
                )}

                {/* Restore result */}
                {restoreResult && (
                    <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg p-4 space-y-2">
                        <p className="font-medium text-emerald-800 dark:text-emerald-300">Obnova dokončena</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                            {Object.entries(restoreResult)
                                .filter(([k, v]) => k.startsWith('restored_') && typeof v === 'number' && v > 0)
                                .map(([key, value]) => (
                                    <div key={key} className="flex justify-between bg-white dark:bg-slate-800 rounded px-3 py-1">
                                        <span className="text-slate-500">{key.replace('restored_', '').replace(/_/g, ' ')}</span>
                                        <span className="font-medium text-emerald-600">{value as number}</span>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};
