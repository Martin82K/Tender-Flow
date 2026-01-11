import React, { useState, useEffect } from 'react';
import { UserManagement } from '../UserManagement';
import { SubscriptionFeaturesManagement } from '../SubscriptionFeaturesManagement';
import { EmailWhitelistManagement } from '../EmailWhitelistManagement';
import { AIApiTest } from './AIApiTest';
import { authService } from '../../services/authService';
import { useUI } from '../../context/UIContext';

interface AdminSettingsProps {
    isAdmin: boolean;
    section?: 'registration' | 'users' | 'subscriptions' | 'ai';
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ isAdmin, section }) => {
    const { showAlert } = useUI();
    // Registration Settings State (Admin only)
    const [allowPublicRegistration, setAllowPublicRegistration] = useState(false);
    const [allowedDomains, setAllowedDomains] = useState('');
    const [requireEmailWhitelist, setRequireEmailWhitelist] = useState(false);
    const [isLoadingSettings, setIsLoadingSettings] = useState(true);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // Load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            if (!isAdmin) return;
            if (section && section !== 'registration') {
                setIsLoadingSettings(false);
                return;
            }
            try {
                const settings = await authService.getAppSettings();
                setAllowPublicRegistration(settings.allowPublicRegistration);
                setAllowedDomains(settings.allowedDomains.join(', '));
                setRequireEmailWhitelist(settings.requireEmailWhitelist || false);
            } catch (error) {
                console.error('Error loading registration settings:', error);
            } finally {
                setIsLoadingSettings(false);
            }
        };
        loadSettings();
    }, [isAdmin, section]);

    const handleSaveRegistrationSettings = async () => {
        setIsSavingSettings(true);
        try {
            const domainsArray = allowedDomains
                .split(',')
                .map(d => d.trim())
                .filter(Boolean);

            await authService.updateAppSettings({
                allowPublicRegistration,
                allowedDomains: domainsArray,
                requireEmailWhitelist
            });
            showAlert({ title: 'Hotovo', message: 'Nastavení registrací uloženo do databáze.', variant: 'success' });
        } catch (error) {
            console.error('Error saving registration settings:', error);
            showAlert({ title: 'Chyba', message: 'Chyba při ukládání nastavení.', variant: 'danger' });
        } finally {
            setIsSavingSettings(false);
        }
    };

    if (!isAdmin) return null;

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Administration Header */}
            <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-400">shield_person</span>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        Administrace systému
                    </h2>
                </div>
                <p className="text-sm text-slate-500">Správa uživatelů, registrací a nastavení AI</p>
            </div>

            {(section === undefined || section === 'registration') && (
                <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl mb-8">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-red-400">admin_panel_settings</span>
                        Nastavení registrací
                        <span className="ml-2 px-2.5 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-lg border border-red-500/30">Admin</span>
                    </h2>

                    {isLoadingSettings ? (
                        <div className="flex justify-center p-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700/50">
                                <div>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">Povolit registrace všem</p>
                                    <p className="text-xs text-slate-500">Pokud je vypnuto, pouze emaily z povolených domén se mohou registrovat.</p>
                                </div>
                                <button
                                    onClick={() => setAllowPublicRegistration(!allowPublicRegistration)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${allowPublicRegistration ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${allowPublicRegistration ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-3">
                                <div>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">Povolit registrace na doménu (whitelist)</p>
                                    <p className="text-xs text-slate-500 mb-2">
                                        Zadejte domény oddělené čárkou. Např.: @baustav.cz, @firma.cz
                                    </p>
                                </div>
                                <input
                                    type="text"
                                    value={allowedDomains}
                                    onChange={(e) => setAllowedDomains(e.target.value)}
                                    placeholder="@baustav.cz, @mojefirma.cz"
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                />
                                <p className="text-xs text-slate-500 italic">
                                    💡 Pokud je povoleno "Povolit registrace všem", tento whitelist se ignoruje.
                                </p>
                            </div>

                            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700/50">
                                <div>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">Vyžadovat whitelist emailů</p>
                                    <p className="text-xs text-slate-500">Pokud je zapnuto, registrovat se mohou pouze emaily explicitně uvedené v seznamu povolených.</p>
                                </div>
                                <button
                                    onClick={() => setRequireEmailWhitelist(!requireEmailWhitelist)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${requireEmailWhitelist ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${requireEmailWhitelist ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    )}

                    {requireEmailWhitelist && (
                        <div className="mt-6 border-t border-slate-200 dark:border-slate-700/50 pt-6">
                            <EmailWhitelistManagement isAdmin={true} />
                        </div>
                    )}

                    <div className="mt-6 flex justify-end border-t border-slate-200 dark:border-slate-700/50 pt-4">
                        <button
                            onClick={handleSaveRegistrationSettings}
                            disabled={isSavingSettings || isLoadingSettings}
                            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className={`material-symbols-outlined ${isSavingSettings ? 'animate-spin' : ''}`}>
                                {isSavingSettings ? 'sync' : 'save'}
                            </span>
                            {isSavingSettings ? 'Ukládám...' : 'Uložit nastavení registrací'}
                        </button>
                    </div>
                </section>
            )}

            {(section === undefined || section === 'users') && (
                <UserManagement isAdmin={isAdmin} />
            )}

            {(section === undefined || section === 'subscriptions') && (
                <SubscriptionFeaturesManagement />
            )}

        </div>
    );
};
