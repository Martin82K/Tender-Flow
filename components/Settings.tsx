import React, { useEffect, useMemo, useState } from 'react';
import { Header } from './Header';
import { StatusConfig, Subcontractor } from '../types';
import { navigate, useLocation } from './routing/router';

// Sub-components
import { AdminSettings } from './settings/AdminSettings';
import { AISettings } from './settings/AISettings';
import { ProfileSettings } from './settings/ProfileSettings';
import { ContactsImportWizard } from './ContactsImportWizard';
import { ExcelUnlockerProSettings } from './settings/ExcelUnlockerProSettings';
import { ExcelMergerProSettings } from './settings/ExcelMergerProSettings';

interface SettingsProps {
    theme: 'light' | 'dark' | 'system';
    onSetTheme: (theme: 'light' | 'dark' | 'system') => void;
    primaryColor: string;
    onSetPrimaryColor: (color: string) => void;

    contactStatuses: StatusConfig[];
    onUpdateStatuses: (statuses: StatusConfig[]) => void;
    onImportContacts: (contacts: Subcontractor[], onProgress?: (percent: number) => void) => Promise<void>;
    onDeleteContacts: (ids: string[]) => void;
    contacts: Subcontractor[];
    isAdmin?: boolean;
    onSaveSettings: () => void;
    user?: any;
}

export const Settings: React.FC<SettingsProps> = ({
    theme,
    onSetTheme,
    primaryColor,
    onSetPrimaryColor,
    contactStatuses,
    onUpdateStatuses,
    onImportContacts,
    onDeleteContacts,
    contacts,
    isAdmin = false,
    onSaveSettings,
    user
}) => {
    const { search } = useLocation();
    type UserSubTab = 'profile' | 'contacts' | 'excelUnlocker' | 'excelMerger';
    type AdminSubTab = 'registration' | 'users' | 'subscriptions' | 'ai';

    // -------------------------------------------------------------------------
    // Routing Logic
    // -------------------------------------------------------------------------
    const settingsRoute = useMemo(() => {
        const params = new URLSearchParams(search);
        const tabParam = params.get('tab');
        const subTabParam = params.get('subTab');
        const tab = tabParam === 'admin' || tabParam === 'user' ? tabParam : null;
        let subTab: string | null = null;
        if (tab === 'user') {
            subTab =
                subTabParam === 'profile' ||
                    subTabParam === 'contacts' ||
                    subTabParam === 'excelUnlocker' ||
                    subTabParam === 'excelMerger' ||
                    subTabParam === 'tools' // legacy
                    ? subTabParam
                    : null;
        } else if (tab === 'admin') {
            subTab =
                subTabParam === 'registration' ||
                    subTabParam === 'users' ||
                    subTabParam === 'subscriptions' ||
                    subTabParam === 'ai'
                    ? subTabParam
                    : null;
        }
        return { tab, subTab };
    }, [search]);

    // Internal State for Tabs (Syncs with URL)
    const [activeTab, setActiveTab] = useState<'user' | 'admin'>(() => {
        if (settingsRoute.tab === 'admin' && isAdmin) return 'admin';
        return 'user';
    });
    const [activeUserSubTab, setActiveUserSubTab] = useState<UserSubTab>(() => {
        if (settingsRoute.subTab === 'contacts' || settingsRoute.subTab === 'excelMerger') return settingsRoute.subTab;
        if (settingsRoute.subTab === 'excelUnlocker') return settingsRoute.subTab;
        if (settingsRoute.subTab === 'tools') return 'excelUnlocker';
        return 'profile';
    });
    const [activeAdminSubTab, setActiveAdminSubTab] = useState<AdminSubTab>(() => {
        if (settingsRoute.subTab === 'users' || settingsRoute.subTab === 'subscriptions' || settingsRoute.subTab === 'ai') {
            return settingsRoute.subTab;
        }
        return 'registration';
    });

    const updateSettingsUrl = (next: { tab: 'user' | 'admin'; subTab?: UserSubTab | AdminSubTab }, opts?: { replace?: boolean }) => {
        const params = new URLSearchParams();
        params.set('tab', next.tab);
        params.set('subTab', next.subTab || (next.tab === 'user' ? 'profile' : 'registration'));
        navigate(`/app/settings?${params.toString()}`, { replace: opts?.replace ?? true });
    };

    useEffect(() => {
        if (settingsRoute.tab === 'admin') {
            if (isAdmin && activeTab !== 'admin') setActiveTab('admin');
            const normalizedAdminSubTab = (settingsRoute.subTab as AdminSubTab) || 'registration';
            if (normalizedAdminSubTab !== activeAdminSubTab) setActiveAdminSubTab(normalizedAdminSubTab);
            return;
        }

        // Default to user tab
        if (activeTab !== 'user') setActiveTab('user');

        if (settingsRoute.subTab) {
            const normalizedSubTab =
                settingsRoute.subTab === 'tools' ? 'excelUnlocker' : (settingsRoute.subTab as any);
            if (normalizedSubTab !== activeUserSubTab) setActiveUserSubTab(normalizedSubTab);
        } else if (activeUserSubTab !== 'profile') {
            setActiveUserSubTab('profile');
        }
    }, [activeAdminSubTab, activeTab, activeUserSubTab, isAdmin, settingsRoute.subTab, settingsRoute.tab]);


    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------
    return (
            <div className="flex flex-col h-full bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen overflow-y-auto">
            <Header title="Nastavení" subtitle="Konfigurace aplikace a správa staveb" />

            <div className="p-6 lg:p-10 w-full pb-20">

                {/* Main Tab Navigation (Top Level) */}
                <div className="flex items-center gap-4 mb-8 border-b border-slate-200 dark:border-slate-700/50">
                    <button
                        onClick={() => {
                            setActiveTab('user');
                            updateSettingsUrl({ tab: 'user', subTab: activeUserSubTab });
                        }}
                        className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'user'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        Prostředí uživatele
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => {
                                setActiveTab('admin');
                                updateSettingsUrl({ tab: 'admin', subTab: activeAdminSubTab });
                            }}
                            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'admin'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            Administrace
                        </button>
                    )}
                </div>

                {/* --- ADMIN TAB CONTENT --- */}
                {activeTab === 'admin' && isAdmin && (
                    <div className="flex flex-col md:flex-row gap-8 animate-fadeIn">
                        <aside className="w-full md:w-64 flex-shrink-0">
                            <nav className="flex flex-col gap-2">
                                <button
                                    onClick={() => updateSettingsUrl({ tab: 'admin', subTab: 'registration' })}
                                    className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${activeAdminSubTab === 'registration'
                                        ? 'bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
                                        Registrace
                                    </div>
                                </button>

                                <button
                                    onClick={() => updateSettingsUrl({ tab: 'admin', subTab: 'users' })}
                                    className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${activeAdminSubTab === 'users'
                                        ? 'bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-[20px]">group</span>
                                        Uživatelé
                                    </div>
                                </button>

                                <button
                                    onClick={() => updateSettingsUrl({ tab: 'admin', subTab: 'subscriptions' })}
                                    className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${activeAdminSubTab === 'subscriptions'
                                        ? 'bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-[20px]">tune</span>
                                        Předplatné
                                    </div>
                                </button>

                                <button
                                    onClick={() => updateSettingsUrl({ tab: 'admin', subTab: 'ai' })}
                                    className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${activeAdminSubTab === 'ai'
                                        ? 'bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                                        AI
                                    </div>
                                </button>
                            </nav>
                        </aside>

                        <main className="flex-1 min-w-0">
                            {activeAdminSubTab === 'registration' && (
                                <AdminSettings isAdmin={isAdmin} section="registration" />
                            )}
                            {activeAdminSubTab === 'users' && (
                                <AdminSettings isAdmin={isAdmin} section="users" />
                            )}
                            {activeAdminSubTab === 'subscriptions' && (
                                <AdminSettings isAdmin={isAdmin} section="subscriptions" />
                            )}
                            {activeAdminSubTab === 'ai' && (
                                <AISettings isAdmin={isAdmin} />
                            )}
                        </main>
                    </div>
                )}

                {/* --- USER TAB CONTENT --- */}
                {activeTab === 'user' && (
                    <div className="flex flex-col md:flex-row gap-8 animate-fadeIn">

                        {/* Sidebar Navigation for User Settings */}
                        <aside className="w-full md:w-64 flex-shrink-0">
                            <nav className="flex flex-col gap-2">
                                <button
                                    onClick={() => updateSettingsUrl({ tab: 'user', subTab: 'profile' })}
                                    className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${activeUserSubTab === 'profile'
                                        ? 'bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-[20px]">person</span>
                                        Profil a Vzhled
                                    </div>
                                </button>

                                <button
                                    onClick={() => updateSettingsUrl({ tab: 'user', subTab: 'contacts' })}
                                    className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${activeUserSubTab === 'contacts'
                                        ? 'bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-[20px]">import_contacts</span>
                                        Import Kontaktů
                                    </div>
                                </button>

                                <button
                                    onClick={() => updateSettingsUrl({ tab: 'user', subTab: 'excelUnlocker' })}
                                    className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${activeUserSubTab === 'excelUnlocker'
                                        ? 'bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-[20px]">lock_open</span>
                                        Excel Unlocker PRO
                                    </div>
                                </button>

                                <button
                                    onClick={() => updateSettingsUrl({ tab: 'user', subTab: 'excelMerger' })}
                                    className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${activeUserSubTab === 'excelMerger'
                                        ? 'bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-[20px]">table_view</span>
                                        Excel Merger PRO
                                    </div>
                                </button>
                            </nav>
                        </aside>

                        {/* Content Area */}
                        <main className="flex-1 min-w-0">
                            {activeUserSubTab === 'profile' && (
                                <ProfileSettings
                                    theme={theme}
                                    onSetTheme={onSetTheme}
                                    primaryColor={primaryColor}
                                    onSetPrimaryColor={onSetPrimaryColor}
                                    contactStatuses={contactStatuses}
                                    onUpdateStatuses={onUpdateStatuses}
                                    onDeleteContacts={onDeleteContacts}
                                    contacts={contacts}
                                    user={user}
                                />
                            )}

                            {activeUserSubTab === 'contacts' && (
                                <section className="space-y-6">
                                    <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-blue-500">import_contacts</span>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                                Import kontaktů
                                            </h2>
                                        </div>
                                        <p className="text-sm text-slate-500">Hromadné nahrávání kontaktů z Excelu nebo CSV</p>
                                    </div>
                                    <ContactsImportWizard
                                        onImport={onImportContacts}
                                        existingContacts={contacts}
                                    />
                                </section>
                            )}

                            {activeUserSubTab === 'excelUnlocker' && (
                                <ExcelUnlockerProSettings />
                            )}

                            {activeUserSubTab === 'excelMerger' && (
                                <ExcelMergerProSettings />
                            )}
                        </main>
                    </div>
                )}
            </div>
        </div>
    );
};
