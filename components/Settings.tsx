import React, { useEffect, useMemo, useState } from 'react';
import { Header } from './Header';
import { StatusConfig, Subcontractor } from '../types';
import { navigate, useLocation } from './routing/router';

// Sub-components
import { AdminSettings } from './settings/AdminSettings';
import { AISettings } from './settings/AISettings';
import { ToolsSettings } from './settings/ToolsSettings';
import { ProfileSettings } from './settings/ProfileSettings';
import { ContactsImportWizard } from './ContactsImportWizard';

interface SettingsProps {
    theme: 'light' | 'dark' | 'system';
    onSetTheme: (theme: 'light' | 'dark' | 'system') => void;
    primaryColor: string;
    onSetPrimaryColor: (color: string) => void;
    backgroundColor: string;
    onSetBackgroundColor: (color: string) => void;

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
    backgroundColor,
    onSetBackgroundColor,
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

    // -------------------------------------------------------------------------
    // Routing Logic
    // -------------------------------------------------------------------------
    const settingsRoute = useMemo(() => {
        const params = new URLSearchParams(search);
        const tabParam = params.get('tab');
        const subTabParam = params.get('subTab');
        const tab = tabParam === 'admin' || tabParam === 'user' ? tabParam : null;
        // Allowed sub-tabs
        const subTab =
            subTabParam === 'profile' || subTabParam === 'contacts' || subTabParam === 'tools' || subTabParam === 'excelMerger'
                ? subTabParam
                : null;
        return { tab, subTab };
    }, [search]);

    // Internal State for Tabs (Syncs with URL)
    const [activeTab, setActiveTab] = useState<'user' | 'admin'>(() => {
        if (settingsRoute.tab === 'admin' && isAdmin) return 'admin';
        return 'user';
    });
    const [activeUserSubTab, setActiveUserSubTab] = useState<'profile' | 'contacts' | 'tools' | 'excelMerger'>(() => {
        if (settingsRoute.subTab === 'contacts' || settingsRoute.subTab === 'tools' || settingsRoute.subTab === 'excelMerger') return settingsRoute.subTab;
        return 'profile';
    });

    const updateSettingsUrl = (next: { tab: 'user' | 'admin'; subTab?: 'profile' | 'contacts' | 'tools' | 'excelMerger' }, opts?: { replace?: boolean }) => {
        const params = new URLSearchParams();
        params.set('tab', next.tab);
        if (next.tab === 'user') {
            params.set('subTab', next.subTab || 'profile');
        }
        navigate(`/app/settings?${params.toString()}`, { replace: opts?.replace ?? true });
    };

    useEffect(() => {
        if (settingsRoute.tab === 'admin') {
            if (isAdmin && activeTab !== 'admin') setActiveTab('admin');
            return;
        }

        // Default to user tab
        if (activeTab !== 'user') setActiveTab('user');

        if (settingsRoute.subTab) {
            if (settingsRoute.subTab !== activeUserSubTab) {
                setActiveUserSubTab(settingsRoute.subTab);
            }
        } else if (activeUserSubTab !== 'profile') {
            setActiveUserSubTab('profile');
        }
    }, [activeTab, activeUserSubTab, isAdmin, settingsRoute.subTab, settingsRoute.tab]);


    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------
    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen overflow-y-auto">
            <Header title="Nastavení" subtitle="Konfigurace aplikace a správa staveb" />

            <div className="p-6 lg:p-10 max-w-5xl mx-auto w-full pb-20">

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
                        Nastavení uživatele
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => {
                                setActiveTab('admin');
                                updateSettingsUrl({ tab: 'admin' });
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
                    <div className="space-y-8 animate-fadeIn">
                        <AdminSettings isAdmin={isAdmin} />
                        <AISettings isAdmin={isAdmin} />
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
                                    onClick={() => updateSettingsUrl({ tab: 'user', subTab: 'tools' })}
                                    className={`text-left px-4 py-3 rounded-xl font-medium text-sm transition-all ${activeUserSubTab === 'tools'
                                        ? 'bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-[20px]">handyman</span>
                                        Nástroje
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
                                    backgroundColor={backgroundColor}
                                    onSetBackgroundColor={onSetBackgroundColor}
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

                            {activeUserSubTab === 'tools' && (
                                <ToolsSettings />
                            )}
                        </main>
                    </div>
                )}
            </div>
        </div>
    );
};
