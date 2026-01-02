
import React, { useEffect, useMemo, useState } from 'react';
import { Header } from './Header';
import { Project, ProjectStatus, StatusConfig, Subcontractor } from '../types';
import { addContactStatus, updateContactStatus, deleteContactStatus } from '../services/contactStatusService';
import { UserManagement } from './UserManagement';
import { EmailWhitelistManagement } from './EmailWhitelistManagement';
import { SubscriptionFeaturesManagement } from './SubscriptionFeaturesManagement';
import { ContactsImportWizard } from './ContactsImportWizard';
import { unlockExcelZip } from '@/utils/excelUnlockZip';
import logo from '../assets/logo.png';
import { navigate, useLocation } from './routing/router';

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
    user?: any; // Add user prop for debug
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
    const EXCEL_MERGER_MIRROR_URL_STORAGE_KEY = 'excelMergerMirrorUrl';

    const settingsRoute = useMemo(() => {
        const params = new URLSearchParams(search);
        const tabParam = params.get('tab');
        const subTabParam = params.get('subTab');
        const tab = tabParam === 'admin' || tabParam === 'user' ? tabParam : null;
        const subTab =
            subTabParam === 'profile' || subTabParam === 'contacts' || subTabParam === 'tools' || subTabParam === 'excelMerger'
                ? subTabParam
                : null;
        return { tab, subTab };
    }, [search]);


    // Status Form State
    const [newStatusLabel, setNewStatusLabel] = useState('');
    const [newStatusColor, setNewStatusColor] = useState<StatusConfig['color']>('blue');

    // Tab State
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

        // Default to user tab (also covers missing/invalid query)
        if (activeTab !== 'user') setActiveTab('user');

        if (settingsRoute.subTab) {
            if (settingsRoute.subTab !== activeUserSubTab) {
                setActiveUserSubTab(settingsRoute.subTab);
            }
        } else if (activeUserSubTab !== 'profile') {
            setActiveUserSubTab('profile');
        }
    }, [activeTab, activeUserSubTab, isAdmin, settingsRoute.subTab, settingsRoute.tab]);

    // Registration Settings State (Admin only) - loaded from database
    const [allowPublicRegistration, setAllowPublicRegistration] = useState(false);
    const [allowedDomains, setAllowedDomains] = useState('');
    const [requireEmailWhitelist, setRequireEmailWhitelist] = useState(false);
    const [isLoadingSettings, setIsLoadingSettings] = useState(true);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // AI Settings State (Admin only) - localStorage
    const [aiEnabled, setAiEnabled] = useState(() => {
        const stored = localStorage.getItem('aiEnabled');
        return stored !== 'false'; // Default to true
    });

    // Display Name State
    const [displayName, setDisplayName] = useState('');
    const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);

    const [isTransferringOwnership, setIsTransferringOwnership] = useState(false);
    const [ownershipTransferStatus, setOwnershipTransferStatus] = useState<string | null>(null);

    // Tools: Excel unlocker
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [isUnlockingExcel, setIsUnlockingExcel] = useState(false);
    const [excelProgress, setExcelProgress] = useState<{ percent: number; label: string } | null>(null);
    const [excelSuccessInfo, setExcelSuccessInfo] = useState<{ outputName: string } | null>(null);
    const [isExcelDropActive, setIsExcelDropActive] = useState(false);

    const acceptExcelFile = (file: File) => {
        if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
            alert('Podporované jsou pouze soubory .xlsx a .xlsm.');
            return;
        }
        setExcelFile(file);
        setExcelProgress(null);
        setExcelSuccessInfo(null);
    };

    const handleUnlockExcelInBrowser = async () => {
        if (!excelFile) {
            alert('Vyberte prosím Excel soubor (.xlsx).');
            return;
        }

        setIsUnlockingExcel(true);
        setExcelSuccessInfo(null);
        try {
            setExcelProgress({ percent: 5, label: 'Kontroluji soubor…' });
            if (!/\.(xlsx|xlsm)$/i.test(excelFile.name)) {
                throw new Error('Podporované jsou pouze soubory .xlsx a .xlsm.');
            }

            const downloadFromResponse = (blob: Blob, filename: string) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            };

            const baseName = excelFile.name.replace(/\.(xlsx|xlsm)$/i, '');
            const extMatch = excelFile.name.match(/\.(xlsx|xlsm)$/i);
            const originalExt = (extMatch?.[1] || 'xlsx').toLowerCase();
            const outputExt = originalExt === 'xlsm' ? 'xlsm' : 'xlsx';
            const fallbackOutName = `${baseName}-odemceno.${outputExt}`;

            setExcelProgress({ percent: 15, label: 'Načítám soubor…' });
            const arrayBuffer = await excelFile.arrayBuffer();

            const out = await unlockExcelZip(arrayBuffer, {
                onProgress: (percent, label) => setExcelProgress({ percent, label }),
            });

            const blob = new Blob([out as any], {
                type:
                    outputExt === 'xlsm'
                        ? 'application/vnd.ms-excel.sheet.macroEnabled.12'
                        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });

            downloadFromResponse(blob, fallbackOutName);
            setExcelProgress({ percent: 100, label: 'Staženo' });
            setExcelSuccessInfo({ outputName: fallbackOutName });
        } catch (e: any) {
            console.error('Excel unlock error:', e);
            alert(`Nepodařilo se odemknout soubor: ${e?.message || 'Neznámá chyba'}`);
            setExcelProgress(null);
        } finally {
            setIsUnlockingExcel(false);
        }
    };

    const normalizeExternalUrl = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('/')) return trimmed;
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        if (/^[a-z0-9.-]+(:\d+)?(\/|$)/i.test(trimmed)) return `http://${trimmed}`;
        return trimmed;
    };

    const getStoredExcelMergerMirrorUrl = () => localStorage.getItem(EXCEL_MERGER_MIRROR_URL_STORAGE_KEY) || '';

    const defaultExcelMergerMirrorUrl = useMemo(() => {
        const envUrl = (import.meta as any)?.env?.VITE_EXCEL_MERGER_MIRROR_URL as string | undefined;
        return envUrl || 'https://vas-excel-merger-gcp.web.app';
    }, []);

    const [excelMergerMirrorUrlDraft, setExcelMergerMirrorUrlDraft] = useState(() => getStoredExcelMergerMirrorUrl());
    const [excelMergerMirrorUrlOverride, setExcelMergerMirrorUrlOverride] = useState(() => getStoredExcelMergerMirrorUrl());
    const [isExcelMergerAddressSettingsOpen, setIsExcelMergerAddressSettingsOpen] = useState(false);

    const excelMergerMirrorUrl = useMemo(() => {
        const raw = excelMergerMirrorUrlOverride.trim();
        if (!raw) return defaultExcelMergerMirrorUrl;
        return normalizeExternalUrl(raw);
    }, [defaultExcelMergerMirrorUrl, excelMergerMirrorUrlOverride]);

    const ExcelMergerMirror: React.FC = () => {
        const [isLoading, setIsLoading] = useState(true);

        useEffect(() => {
            setIsLoading(true);
        }, [excelMergerMirrorUrl]);

        return (
            <div className="relative w-full h-[800px] mt-6 rounded-3xl border border-slate-200/70 dark:border-white/10 overflow-hidden bg-white/70 dark:bg-white/5 backdrop-blur">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-slate-950/70 z-50">
                        <div className="flex flex-col items-center gap-4 text-center px-6">
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                            <div className="space-y-1">
                                <p className="font-black text-slate-900 dark:text-white">Propojování s ExcelMerger Pro…</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    Načítám externí aplikaci ve vestavěném okně.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                <iframe
                    key={excelMergerMirrorUrl}
                    src={excelMergerMirrorUrl}
                    className="w-full h-full border-none"
                    onLoad={() => setIsLoading(false)}
                    sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-downloads"
                    referrerPolicy="no-referrer"
                />
            </div>
        );
    };

    // Load display name on mount
    React.useEffect(() => {
        if (user?.id) {
            loadDisplayName();
        }
    }, [user?.id]);

    const loadDisplayName = async () => {
        try {
            const { supabase } = await import('../services/supabase');
            const { data, error } = await supabase
                .from('user_profiles')
                .select('display_name')
                .eq('user_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = not found
                console.error('Error loading display name:', error);
                return;
            }

            if (data) {
                setDisplayName(data.display_name || '');
            }
        } catch (error) {
            console.error('Error loading display name:', error);
        }
    };

    const handleSaveDisplayName = async () => {
        if (!user?.id) {
            alert('Uživatel není přihlášen');
            return;
        }

        setIsSavingDisplayName(true);
        try {
            const { supabase } = await import('../services/supabase');

            const { error } = await supabase
                .from('user_profiles')
                .upsert({
                    user_id: user.id,
                    display_name: displayName || null,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });

            if (error) {
                console.error('Upsert error:', error);
                throw error;
            }

            alert('Zobrazované jméno bylo uloženo');
        } catch (error: any) {
            console.error('Error saving display name:', error);
            alert(`Chyba při ukládání jména: ${error?.message || 'Neznámá chyba'}`);
        } finally {
            setIsSavingDisplayName(false);
        }
    };

    const handleAssignOwnershipToBaustav = async () => {
        if (!isAdmin) {
            setOwnershipTransferStatus('Nemáte oprávnění (pouze Admin).');
            return;
        }
        if (!confirm('Opravdu chcete převést vlastnictví vybraných staveb na kalkus@baustav.cz?')) return;

        setIsTransferringOwnership(true);
        setOwnershipTransferStatus(null);
        try {
            const { supabase } = await import('../services/supabase');

            const { data: targetUserId, error: userIdError } = await supabase.rpc('get_user_id_by_email', {
                email_input: 'kalkus@baustav.cz'
            });
            if (userIdError) throw userIdError;
            if (!targetUserId) throw new Error('Uživatel kalkus@baustav.cz nebyl nalezen v auth.users (musí se nejdřív zaregistrovat/přihlásit).');

            const projectNames = ['Krajská nemocnice', 'REKO Bazén Aš'];
            const updated: Array<{ name: string; count: number }> = [];

            for (const name of projectNames) {
                const { data, error } = await supabase
                    .from('projects')
                    .update({ owner_id: targetUserId })
                    .ilike('name', name)
                    .select('id');
                if (error) throw error;
                updated.push({ name, count: Array.isArray(data) ? data.length : 0 });
            }

            const summary = updated.map((u) => `${u.name}: ${u.count}`).join(', ');
            setOwnershipTransferStatus(`Hotovo. Aktualizováno: ${summary}`);
        } catch (e: any) {
            const msg = e?.message || String(e);
            setOwnershipTransferStatus(`Chyba: ${msg}`);
        } finally {
            setIsTransferringOwnership(false);
        }
    };

    // Default AI Prompts
    const DEFAULT_PROMPT_ACHIEVEMENTS = `Jsi kreativní analytik stavebních projektů. Vygeneruj 4-5 UNIKÁTNÍCH achievement-style insights ve stylu herních úspěchů. Buď kreativní - každé volání má být jiné!

Odpověz POUZE jako JSON pole. Každý insight může mít tyto vlastnosti:
{
  "title": "Název achievementu (kreativní, ve stylu hry)",
  "content": "Krátký popis (max 80 znaků)",
  "type": "achievement|success|warning|info|tip",
  "icon": "material_icon",
  "progress": 0-100 (volitelné, pro progress bar),
  "achievement": { "level": 1-5, "maxLevel": 5, "label": "Bronze/Silver/Gold/Platinum/Diamond" } (volitelné),
  "stats": [{ "label": "Název", "value": "Hodnota", "trend": "up|down|neutral" }] (volitelné, max 2 položky)
}

PŘÍKLADY NÁZVŮ: "💰 Mistr úspor", "🏆 SOD Champion", "📊 Analytik měsíce", "🚀 Speed Builder"`;

    const DEFAULT_PROMPT_CHARTS = `Jsi elitní stavební manažer a krizový finanční stratég s 20 lety praxe. Tvým cílem není jen zobrazovat suchá data, ale okamžitě vizualizovat zdraví projektů, rizika a efektivitu nákupu.

Když analyzuješ data, hledej odpovědi na tyto klíčové otázky a převeď je do grafů:

1. EFEKTIVITA NÁKUPU (Buyout Savings): Porovnej rozpočet vs. smluvní ceny. Kde šetříme a kde proděláváme? (Využij sloupcový graf pro porovnání Rozpočet vs. Náklady).
2. ZISKOVOST PROJEKTŮ: Které stavby generují největší marži a které jsou rizikové? (Koláčový graf rozdělení zisku nebo sloupcový graf marží).
3. RYCHLOST KONTRAHOVÁNÍ (Risk Management): Máme zasmluvněno dostatek subdodavatelů vzhledem k fázi projektu? (Progress bar pro uzavřené SOD).

POKYNY:
- Barvy: ČERVENÁ = ztráta/riziko, ZELENÁ = úspora/zisk, MODRÁ = neutrální.
- V popisu grafu (content) vysvětli MANAŽERSKÝ DOPAD.

Vygeneruj 3-4 grafy. Odpověz POUZE jako JSON pole s grafy:
{
  "title": "Název grafu",
  "content": "Manažerský insight (proč na tom záleží)",
  "type": "chart",
  "icon": "bar_chart|pie_chart|show_chart|analytics|savings|trending_up",
  "chartType": "bar|pie|progress",
  "chartData": [{ "label": "Položka", "value": číslo, "color": "#hex" }]
}

TYPY GRAFŮ: bar, pie, progress`;

    const DEFAULT_PROMPT_REPORTS = `Jsi zkušený stavbyvedoucí a projektový manažer. Připravuješ přehledné reporty o stavu projektů pro vedení firmy a investory.

Vygeneruj 3-4 reportovací položky.

Odpověz POUZE jako JSON pole:
{
  "title": "Název sekce reportu",
  "content": "Stručný text reportu (2-3 věty, klíčové informace pro management)",
  "type": "info|success|warning|tip",
  "icon": "summarize|assessment|analytics|report|trending_up|trending_down|warning|check_circle",
  "stats": [{ "label": "Metrika", "value": "Hodnota", "trend": "up|down|neutral" }]
}

Piš profesionálně ale srozumitelně. Report by měl být užitečný pro rychlé rozhodování vedení!`;

    const DEFAULT_PROMPT_OVERVIEW = `Jsi zkušený stavební analytik a projektový manažer. Na základě níže uvedených dat z výběrových řízení vytvoř detailní manažerské hodnocení projektu.

### Kontext:
Údaje představují výsledky výběrových řízení na jednotlivé části stavby (subdodávky, materiály, služby). Data obsahují:
- Názvy položek nebo zakázek a jejich finanční hodnoty
- Nabídnuté ceny a rozdíly vůči rozpočtu
- Počty nabídek a úspěšnost výběrových řízení
- Stav uzavření smluv (SOD)

### Úkol:
Vygeneruj komplexní slovní hodnocení projektu z pohledu:

**1. FINANČNÍ ANALÝZA**
Srovnej nabídkové ceny s rozpočtem, identifikuj úspory nebo překročení, uveď míru konkurence a efektivitu výběrových řízení.

**2. SMLUVNÍ A PROCESNÍ STAV**
Zhodnoť postup uzavírání smluv, počet dokončených vs. otevřených poptávek, identifikuj případná rizika v procesu.

**3. DODAVATELSKÁ SITUACE**
Popiš celkovou situaci s dodavateli - počet nabídek na poptávku, konkurenceschopnost trhu, případné problémy s nedostatkem nabídek.

**4. CELKOVÉ ŘÍZENÍ PROJEKTU**
Shrň, jak výběrová řízení ovlivnila celkové řízení stavby, ekonomiku projektu a další fáze.

### Formát výstupu:
- Piš **profesionálně, věcně a přehledně**
- Používej **tučné nadpisy** pro sekce (pomocí **)
- Používej odrážky pro přehlednost
- Formulace typu: "Z finančního hlediska lze konstatovat...", "Analýza ukázala..."
- Na konci přidej **SHRNUTÍ A DOPORUČENÍ** pro další postup
- Délka: 300-500 slov
- Výstup bude zobrazen v UI, proto používej markdown formátování`;

    // AI Prompts State (Admin only) - with defaults
    const [promptContacts, setPromptContacts] = useState(() =>
        localStorage.getItem('aiPromptContacts') || ''
    );
    const [promptOverview, setPromptOverview] = useState(() =>
        localStorage.getItem('aiPromptOverview') || DEFAULT_PROMPT_OVERVIEW
    );

    // Initialize localStorage with defaults if empty
    React.useEffect(() => {
        if (!localStorage.getItem('aiPromptContacts')) {
            localStorage.setItem('aiPromptContacts', '');
        }
        if (!localStorage.getItem('aiPromptOverview')) {
            localStorage.setItem('aiPromptOverview', DEFAULT_PROMPT_OVERVIEW);
        }
    }, []);

    // Save AI setting to localStorage when it changes
    React.useEffect(() => {
        localStorage.setItem('aiEnabled', aiEnabled.toString());
    }, [aiEnabled]);

    // Prompts saved feedback
    const [promptsSaved, setPromptsSaved] = useState(false);

    // Save prompts to localStorage
    const savePrompts = () => {
        localStorage.setItem('aiPromptContacts', promptContacts);
        localStorage.setItem('aiPromptOverview', promptOverview);
        setPromptsSaved(true);
        setTimeout(() => setPromptsSaved(false), 3000);
    };

    // Load registration settings from database on mount
    React.useEffect(() => {
        const loadSettings = async () => {
            if (!isAdmin) return;
            try {
                const { authService } = await import('../services/authService');
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
    }, [isAdmin]);

    const handleSaveRegistrationSettings = async () => {
        setIsSavingSettings(true);
        try {
            const { authService } = await import('../services/authService');
            const domainsArray = allowedDomains
                .split(',')
                .map(d => d.trim())
                .filter(Boolean);

            await authService.updateAppSettings({
                allowPublicRegistration,
                allowedDomains: domainsArray,
                requireEmailWhitelist
            });
            alert('Nastavení registrací uloženo do databáze.');
        } catch (error) {
            console.error('Error saving registration settings:', error);
            alert('Chyba při ukládání nastavení.');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleDeleteAllContacts = () => {
        if (contacts.length === 0) {
            alert('Databáze kontaktů je již prázdná.');
            return;
        }

        if (confirm(`VAROVÁNÍ: Opravdu chcete smazat VŠECHNY kontakty (${contacts.length}) z databáze? Tuto akci nelze vrátit zpět!`)) {
            if (confirm('Opravdu? Jste si naprosto jistí?')) {
                const allIds = contacts.map(c => c.id);
                onDeleteContacts(allIds);
            }
        }
    };



    const handleAddStatus = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStatusLabel) return;

        const id = newStatusLabel.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString().slice(-4);

        const newStatus: StatusConfig = {
            id,
            label: newStatusLabel,
            color: newStatusColor
        };

        // Optimistic update
        onUpdateStatuses([...contactStatuses, newStatus]);
        setNewStatusLabel('');

        // Persist to database
        const success = await addContactStatus(newStatus);
        if (!success) {
            alert('Chyba při ukládání stavu do databáze.');
        }
    };

    const handleDeleteStatus = async (id: string) => {
        if (confirm('Opravdu smazat tento status? Kontakty s tímto statusem budou muset být přeřazeny.')) {
            // Optimistic update
            onUpdateStatuses(contactStatuses.filter(s => s.id !== id));

            // Persist to database
            const success = await deleteContactStatus(id);
            if (!success) {
                alert('Chyba při mazání stavu z databáze.');
            }
        }
    };

    const handleUpdateStatusLabel = async (id: string, newLabel: string) => {
        // Optimistic update
        onUpdateStatuses(contactStatuses.map(s => s.id === id ? { ...s, label: newLabel } : s));

        // Debounced persist - update on blur instead
    };

    const handleStatusLabelBlur = async (id: string, newLabel: string) => {
        const success = await updateContactStatus(id, { label: newLabel });
        if (!success) {
            alert('Chyba při ukládání změny do databáze.');
        }
    };

    const handleUpdateStatusColor = async (id: string, newColor: StatusConfig['color']) => {
        // Optimistic update
        onUpdateStatuses(contactStatuses.map(s => s.id === id ? { ...s, color: newColor } : s));

        // Persist to database
        const success = await updateContactStatus(id, { color: newColor });
        if (!success) {
            alert('Chyba při ukládání barvy do databáze.');
        }
    };

    const colorOptions: { value: StatusConfig['color'], class: string }[] = [
        { value: 'green', class: 'bg-green-500' },
        { value: 'blue', class: 'bg-blue-500' },
        { value: 'red', class: 'bg-red-500' },
        { value: 'yellow', class: 'bg-yellow-500' },
        { value: 'purple', class: 'bg-purple-500' },
        { value: 'slate', class: 'bg-slate-500' },
    ];

    const themeColors = [
        '#607AFB', // Default Blue
        '#3B82F6', // Vivid Blue
        '#10B981', // Emerald
        '#F59E0B', // Amber
        '#EF4444', // Red
        '#8B5CF6', // Violet
        '#EC4899', // Pink
        '#6366F1', // Indigo
    ];

    const backgroundColors = [
        { label: 'Výchozí', color: '#f5f6f8' },
        { label: 'Čistá bílá', color: '#ffffff' },
        { label: 'Teplá', color: '#fbf7f1' },
        { label: 'Studená', color: '#f0f9ff' },
    ];

    // Import řeší wizard komponenta (XLSX/CSV + mapování + náhled)

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen overflow-y-auto">
            <Header title="Nastavení" subtitle="Konfigurace aplikace a správa staveb" />

                <div className="p-6 lg:p-10 max-w-5xl mx-auto w-full pb-20">

                {/* Tab Navigation */}
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

                        {/* Registration Settings */}
                    <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl mb-8">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-red-400">admin_panel_settings</span>
                            Nastavení registrací
                            <span className="ml-2 px-2.5 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-lg border border-red-500/30">Admin</span>
                        </h2>

                        <div className="space-y-6">
                            {/* Allow Public Registration Toggle */}
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

                            {/* Domain Whitelist */}
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


                            {/* Require Email Whitelist Toggle */}
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

                        {/* Whitelist Management (Only if enabled) */}
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



                        <UserManagement isAdmin={isAdmin} />

                        <SubscriptionFeaturesManagement />

                        {/* AI Settings */}
                    <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl mb-8">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-violet-400">auto_awesome</span>
                            Nastavení AI funkcí
                            <span className="ml-2 px-2.5 py-1 bg-violet-500/20 text-violet-400 text-xs font-bold rounded-lg border border-violet-500/30">Admin</span>
                        </h2>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">Povolit AI analýzu</p>
                                <p className="text-xs text-slate-500">Aktivuje AI Insights na Dashboardu pomocí Gemini API.</p>
                            </div>
                            <button
                                onClick={() => setAiEnabled(!aiEnabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${aiEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${aiEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {!aiEnabled && (
                            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px]">warning</span>
                                    AI funkce jsou vypnuty. Uživatelé uvidí lokální statistiky místo AI analýzy.
                                </p>
                            </div>
                        )}

                        {/* AI Prompts Management */}
                        {aiEnabled && (
                            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px]">edit_note</span>
                                        Správa AI Promptů
                                    </h3>
                                    <button
                                        onClick={savePrompts}
                                        className={`px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${promptsSaved
                                            ? 'bg-green-500'
                                            : 'bg-primary hover:bg-primary/90'
                                            }`}
                                    >
                                        {promptsSaved ? (
                                            <>
                                                <span className="material-symbols-outlined text-[14px]">check</span>
                                                Uloženo!
                                            </>
                                        ) : (
                                            'Uložit prompty'
                                        )}
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Přizpůsobte instrukce pro AI. Prázdné pole = použije se výchozí systémový prompt.
                                </p>

                                {/* Contacts Prompt */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                                        <span>👥</span> Prompt pro Kontakty
                                    </label>
                                    <textarea
                                        value={promptContacts}
                                        onChange={(e) => setPromptContacts(e.target.value)}
                                        placeholder="Výchozí: Jsi analytik subdodavatelů. Analyzuj výkonnost subdodavatelů, nejčastější účastníky poptávek..."
                                        className="w-full h-24 p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary resize-y"
                                    />
                                </div>

                                {/* Overview Prompt */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                                        <span>📊</span> Prompt pro Přehled staveb
                                    </label>
                                    <textarea
                                        value={promptOverview}
                                        onChange={(e) => setPromptOverview(e.target.value)}
                                        placeholder="Výchozí: Analyzuj finanční stav projektu, porovnej rozpočet s plánem a zasmluvněnými dodavateli..."
                                        className="w-full h-24 p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary resize-y"
                                    />
                                </div>
                            </div>
                        )}
                    </section>



                    </div>
                )}

                {/* --- USER TAB CONTENT --- */}
                {activeTab === 'user' && (
                    <div className="space-y-8 animate-fadeIn">
                        {/* Sub-tab Navigation */}
                        <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-800 pb-2">
                             <button
                                onClick={() => {
                                    setActiveUserSubTab('profile');
                                    updateSettingsUrl({ tab: 'user', subTab: 'profile' });
                                }}
                                className={`pb-2 px-1 text-sm font-medium transition-colors relative ${activeUserSubTab === 'profile'
                                    ? 'text-primary'
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                Profil
                                {activeUserSubTab === 'profile' && (
                                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setActiveUserSubTab('contacts');
                                    updateSettingsUrl({ tab: 'user', subTab: 'contacts' });
                                }}
                                className={`pb-2 px-1 text-sm font-medium transition-colors relative ${activeUserSubTab === 'contacts'
                                    ? 'text-primary'
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                Kontakty
                                {activeUserSubTab === 'contacts' && (
                                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setActiveUserSubTab('tools');
                                    updateSettingsUrl({ tab: 'user', subTab: 'tools' });
                                }}
                                className={`pb-2 px-1 text-sm font-medium transition-colors relative ${activeUserSubTab === 'tools'
                                    ? 'text-primary'
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                ExcelUnlocker Pro
                                {activeUserSubTab === 'tools' && (
                                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setActiveUserSubTab('excelMerger');
                                    updateSettingsUrl({ tab: 'user', subTab: 'excelMerger' });
                                }}
                                className={`pb-2 px-1 text-sm font-medium transition-colors relative ${activeUserSubTab === 'excelMerger'
                                    ? 'text-primary'
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                ExcelMerger Pro
                                {activeUserSubTab === 'excelMerger' && (
                                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
                                )}
                            </button>
                        </div>

                        {/* --- USER: PROFILE SUB-TAB --- */}
                        {activeUserSubTab === 'profile' && (
                            <>

                        {/* Profile Settings Section */}
                <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl mb-8">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-400">person</span>
                        Profil
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Email</label>
                            <input
                                type="text"
                                value={user?.email || ''}
                                disabled
                                className="w-full rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-400"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Zobrazované jméno</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Např. Martin Kalkus"
                                    className="flex-1 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500/50 focus:outline-none"
                                />
                                <button
                                    onClick={handleSaveDisplayName}
                                    disabled={isSavingDisplayName}
                                    className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isSavingDisplayName && <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>}
                                    Uložit
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Toto jméno se zobrazí ostatním uživatelům při sdílení projektů</p>
                        </div>
                    </div>
                </section>



                {/* 1. Appearance Section */}
                <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl mb-8">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-pink-400">palette</span>
                        Vzhled aplikace
                    </h2>

                    <div className="space-y-6">
                        {/* Theme Mode Selector */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">Motiv aplikace</p>
                                <p className="text-xs text-slate-500">Vyberte preferovaný vzhled aplikace.</p>
                            </div>
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => onSetTheme('light')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                                        theme === 'light'
                                            ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[16px]">light_mode</span>
                                    Světlý
                                </button>
                                <button
                                    onClick={() => onSetTheme('dark')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                                        theme === 'dark'
                                            ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[16px]">dark_mode</span>
                                    Tmavý
                                </button>
                                <button
                                    onClick={() => onSetTheme('system')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                                        theme === 'system'
                                            ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[16px]">settings_system_daydream</span>
                                    Systém
                                </button>
                            </div>
                        </div>

                        {/* Color Theme */}
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">Barevné schéma</p>
                                    <p className="text-xs text-slate-500">Vyberte hlavní barvu aplikace (Brand Color).</p>
                                </div>
                                <div className="flex flex-wrap gap-3 items-center">
                                    {themeColors.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => onSetPrimaryColor(color)}
                                            className={`size-8 rounded-full transition-all shadow-sm ${primaryColor === color ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500 scale-110' : 'hover:scale-105'}`}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                    <div className="relative flex items-center">
                                        <label htmlFor="custom-color" className="cursor-pointer size-8 rounded-full bg-gradient-to-tr from-white to-slate-200 border border-slate-300 flex items-center justify-center hover:scale-105 transition-transform" title="Vlastní barva">
                                            <span className="material-symbols-outlined text-[16px] text-slate-600">colorize</span>
                                        </label>
                                        <input
                                            id="custom-color"
                                            type="color"
                                            value={primaryColor}
                                            onChange={(e) => onSetPrimaryColor(e.target.value)}
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>


                    </div>

                    <div className="mt-6 flex justify-end border-t border-slate-100 dark:border-slate-800 pt-4">
                        <button
                            onClick={onSaveSettings}
                            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all hover:scale-105 active:scale-95"
                        >
                            <span className="material-symbols-outlined text-[18px]">save</span>
                            Uložit
                        </button>
                    </div>
                </section>
                </>
                )}

                {/* --- USER: CONTACTS SUB-TAB --- */}
                {activeUserSubTab === 'contacts' && (
                    <>

                        {/* 2. Subcontractor Status Management - MOVED TO ADMIN */}


                {/* 3. Import Data Section */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined">upload_file</span>
                            Import Kontaktů
                        </h2>
                        {isAdmin && (
                            <button
                                onClick={handleDeleteAllContacts}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                title="Smazat všechny kontakty z databáze"
                            >
                                <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                                Smazat vše
                            </button>
                        )}
                    </div>

                    <ContactsImportWizard
                        contacts={contacts}
                        statuses={contactStatuses}
                        defaultStatusId="available"
                        onImportContacts={onImportContacts}
                    />
                </section>

                {/* Subcontractor Status Management - User Tab */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm mt-8">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined">label</span>
                        Správa stavů kontaktů
                    </h2>

                    {/* Add Status */}
                    <form onSubmit={handleAddStatus} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 mb-6 flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-xs text-slate-500 mb-1">Název stavu</label>
                            <input
                                type="text"
                                value={newStatusLabel}
                                onChange={(e) => setNewStatusLabel(e.target.value)}
                                placeholder="Např. Dovolená"
                                className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <div className="w-full md:w-auto">
                            <label className="block text-xs text-slate-500 mb-1">Barva</label>
                            <div className="flex gap-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 h-[38px] items-center">
                                {colorOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setNewStatusColor(opt.value)}
                                        className={`size-6 rounded-full ${opt.class} ${newStatusColor === opt.value ? 'ring-2 ring-offset-1 ring-slate-400 dark:ring-slate-500 scale-110' : 'opacity-70 hover:opacity-100'}`}
                                        title={opt.value}
                                    />
                                ))}
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={!newStatusLabel}
                            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 h-[38px] rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
                        >
                            Přidat
                        </button>
                    </form>

                    {/* Status List */}
                    <div className="space-y-3">
                        {contactStatuses.map(status => (
                            <div key={status.id} className="flex items-center gap-4 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <div className="flex gap-1.5 items-center bg-slate-100 dark:bg-slate-800 rounded px-2 py-1">
                                    {colorOptions.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => handleUpdateStatusColor(status.id, opt.value)}
                                            className={`size-4 rounded-full ${opt.class} ${status.color === opt.value ? 'ring-2 ring-offset-1 ring-white dark:ring-slate-900' : 'opacity-40 hover:opacity-100'}`}
                                        />
                                    ))}
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={status.label}
                                        onChange={(e) => handleUpdateStatusLabel(status.id, e.target.value)}
                                        onBlur={(e) => handleStatusLabelBlur(status.id, e.target.value)}
                                        className="bg-transparent border-none p-0 text-sm font-medium text-slate-900 dark:text-white focus:ring-0 w-full"
                                    />
                                </div>
                                <button
                                    onClick={() => handleDeleteStatus(status.id)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                    title="Smazat stav"
                                >
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
                </>
                )}

                {/* --- USER: TOOLS SUB-TAB --- */}
                {activeUserSubTab === 'tools' && (
                    <div className="space-y-8 animate-fadeIn">
                        <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-200/60 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl shadow-2xl shadow-slate-200/50 dark:shadow-none">
                            {/* Animated Background Elements */}
                            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                                <div className="absolute -top-[10%] -left-[10%] size-[40rem] rounded-full bg-gradient-to-br from-emerald-400/20 to-transparent blur-[120px] dark:from-emerald-500/15 animate-pulse" />
                                <div className="absolute -bottom-[15%] -right-[5%] size-[35rem] rounded-full bg-gradient-to-tr from-primary/20 to-transparent blur-[100px] dark:from-primary/10" />
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px]" />
                            </div>

                            <div className="relative px-8 py-12 sm:px-14 sm:py-16">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                                    <div className="flex-1 space-y-6">
                                        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                                            <span className="material-symbols-outlined text-[20px]">verified</span>
                                            <span className="text-sm font-bold tracking-wide uppercase">Enterprise Tool</span>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            <h3 className="text-5xl sm:text-6xl font-black tracking-tight text-slate-950 dark:text-white leading-[1.1]">
                                                Excel<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-emerald-400">Unlocker</span> <span className="relative">Pro<span className="absolute -right-8 -top-2 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span></span></span>
                                            </h3>
                                            <p className="max-w-xl text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                                                Profesionální nástroj pro <span className="text-slate-900 dark:text-white font-bold underline decoration-emerald-500/30">okamžité odstranění ochrany listu</span>. Vše probíhá bezpečně ve vašem prohlížeči.
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-4 pt-4">
                                            {[
                                                { icon: 'shield_lock', label: '100% Soukromé', color: 'emerald' },
                                                { icon: 'bolt', label: 'Ultra Rychlé', color: 'amber' },
                                                { icon: 'description', label: 'Full Protocol Support', color: 'primary' }
                                            ].map((badge) => (
                                                <div key={badge.label} className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-white/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 backdrop-blur-xl shadow-sm">
                                                    <span className={`material-symbols-outlined text-[20px] text-${badge.color}-600 dark:text-${badge.color}-400`}>{badge.icon}</span>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{badge.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="hidden lg:flex flex-col items-center gap-4">
                                        <div className="size-24 rounded-[2rem] bg-slate-950 flex items-center justify-center border-4 border-slate-800 shadow-2xl shadow-emerald-500/20 rotate-3 hover:rotate-0 transition-transform duration-500">
                                            <img src={logo} alt="Tender Flow" className="h-16 w-auto object-contain p-2" />
                                        </div>
                                        <div className="h-12 w-1 border-l-2 border-dashed border-slate-300 dark:border-slate-700" />
                                        <div className="size-16 rounded-3xl bg-emerald-600 text-white flex items-center justify-center shadow-lg transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                                            <span className="material-symbols-outlined text-3xl">grid_on</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-8">
                                    <div className="lg:col-span-7">
                                        <div className="group relative rounded-[2.5rem] border border-slate-200/70 dark:border-white/10 bg-white/90 dark:bg-slate-950/60 backdrop-blur-2xl shadow-2xl p-8 transition-all duration-500 hover:shadow-emerald-500/10">
                                            <div className="flex items-center justify-between mb-8">
                                                <div>
                                                    <h4 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Odemknout soubor</h4>
                                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Podporované formáty: .xlsx, .xlsm</p>
                                                </div>
                                                <div className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border border-slate-200/50 dark:border-white/5">
                                                    Local Process
                                                </div>
                                            </div>

                                            <input
                                                id="excel-file-input"
                                                type="file"
                                                accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) acceptExcelFile(file);
                                                }}
                                                className="hidden"
                                            />

                                            <button
                                                type="button"
                                                onClick={() => document.getElementById('excel-file-input')?.click()}
                                                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsExcelDropActive(true); }}
                                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsExcelDropActive(true); }}
                                                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsExcelDropActive(false); }}
                                                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsExcelDropActive(false); const file = e.dataTransfer.files?.[0]; if (file) acceptExcelFile(file); }}
                                                className={`group/drop mt-6 w-full rounded-[2rem] border-2 border-dashed transition-all duration-500 px-8 py-14 text-center ${isExcelDropActive
                                                    ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 scale-[0.99]'
                                                    : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/5'
                                                    }`}
                                            >
                                                <div className={`mx-auto size-20 rounded-[1.75rem] border flex items-center justify-center shadow-inner transition-all duration-500 ${
                                                    isExcelDropActive ? 'bg-emerald-500 text-white border-emerald-400 rotate-12' : 'bg-white dark:bg-white/5 text-emerald-600 dark:text-emerald-400 border-slate-200/60 dark:border-white/10 group-hover/drop:scale-110 group-hover/drop:rotate-6'
                                                }`}>
                                                    <span className={`material-symbols-outlined text-[36px] ${isExcelDropActive ? 'animate-bounce' : ''}`}>
                                                        {excelFile ? 'description' : 'cloud_upload'}
                                                    </span>
                                                </div>
                                                <div className="mt-8">
                                                    <div className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                                                        {excelFile ? excelFile.name : 'Vyberte soubor pro odemčení'}
                                                    </div>
                                                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-[280px] mx-auto">
                                                        {excelFile ? `${(excelFile.size / 1024).toFixed(1)} KB • Připraveno` : 'Přetáhněte soubor sem nebo klikněte pro procházení zařízení'}
                                                    </p>
                                                </div>
                                            </button>

                                            <button
                                                onClick={handleUnlockExcelInBrowser}
                                                disabled={!excelFile || isUnlockingExcel}
                                                className="group/btn mt-8 relative w-full inline-flex items-center justify-center gap-3 px-8 py-5 rounded-3xl bg-slate-950 dark:bg-white dark:text-slate-950 text-white font-black text-lg shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed overflow-hidden"
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-primary opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
                                                <div className="relative flex items-center gap-3">
                                                    {isUnlockingExcel ? (
                                                        <>
                                                            <span className="material-symbols-outlined animate-spin text-2xl">sync</span>
                                                            <span>Zpracovávám…</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="material-symbols-outlined text-2xl">lock_open</span>
                                                            <span>Odemknout a stáhnout</span>
                                                        </>
                                                    )}
                                                </div>
                                            </button>

                                            {excelProgress && (
                                                <div className="mt-8 space-y-3">
                                                    <div className="flex items-center justify-between px-1">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">{excelProgress.label}</span>
                                                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{excelProgress.percent}%</span>
                                                    </div>
                                                    <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-white/5 p-0.5 border border-slate-200/50 dark:border-white/5">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-primary shadow-[0_0_12px_rgba(16,185,129,0.4)] transition-[width] duration-700 ease-out"
                                                            style={{ width: `${Math.max(0, Math.min(100, excelProgress.percent))}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {excelSuccessInfo && (
                                                <div className="mt-8 animate-fadeInUp">
                                                    <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/20 p-6 flex items-start gap-4 shadow-xl shadow-emerald-500/10">
                                                        <div className="size-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                                            <span className="material-symbols-outlined text-2xl">check_circle</span>
                                                        </div>
                                                        <div>
                                                            <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Odemčeno a staženo</h5>
                                                            <p className="text-xs font-medium text-slate-600 dark:text-emerald-100/80 mt-1 leading-relaxed">
                                                                Soubor <span className="text-emerald-700 dark:text-emerald-300 font-bold">{excelSuccessInfo.outputName}</span> byl vytvořen. Původní soubor můžete smazat.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="lg:col-span-5 space-y-6">
                                        <div className="rounded-[2.5rem] border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-slate-900/40 backdrop-blur-2xl p-8 sm:p-10 shadow-xl">
                                            <div className="flex items-center gap-3 text-slate-950 dark:text-white mb-8">
                                                <div className="size-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-xl">info</span>
                                                </div>
                                                <h4 className="text-lg font-black tracking-tight uppercase tracking-wider">Metodika</h4>
                                            </div>
                                            
                                            <ul className="space-y-6">
                                                {[
                                                    { 
                                                        icon: 'verified_user', 
                                                        title: 'Odstraňuje ochranu listů', 
                                                        desc: 'Cíleně maže tag <sheetProtection> v XML struktuře souboru.',
                                                        color: 'text-emerald-500'
                                                    },
                                                    { 
                                                        icon: 'history_edu', 
                                                        title: 'Integrita dat zachována', 
                                                        desc: 'Obsah a formátování zůstávají beze změny, upravují se pouze metadata.',
                                                        color: 'text-emerald-500'
                                                    },
                                                    { 
                                                        icon: 'report_problem', 
                                                        title: 'Limitace šifrování', 
                                                        desc: 'Nástroj neprolamuje "Password to open" (šifrování celého ZIP archivu).',
                                                        color: 'text-amber-500'
                                                    }
                                                ].map((item, idx) => (
                                                    <li key={idx} className="group/item flex gap-5">
                                                        <span className={`material-symbols-outlined mt-0.5 transition-transform group-hover/item:scale-110 ${item.color}`}>{item.icon}</span>
                                                        <div>
                                                            <div className="text-sm font-black text-slate-900 dark:text-white tracking-tight">{item.title}</div>
                                                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{item.desc}</div>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>

                                            <div className="mt-10 p-6 rounded-3xl bg-slate-950 text-white shadow-2xl overflow-hidden relative group/tip">
                                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/tip:opacity-20 transition-opacity">
                                                    <span className="material-symbols-outlined text-4xl">lightbulb</span>
                                                </div>
                                                <div className="relative">
                                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-2">Expert Tip</div>
                                                    <p className="text-xs font-medium leading-relaxed text-slate-300">
                                                        Není nutné ručně měnit koncovky souborů. Pokud nahráváte <span className="text-white font-bold">.xlsm</span>, systém vrátí korektní makro-soubor se zachovanou vnitřní strukturou.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* --- USER: EXCEL MERGER SUB-TAB --- */}
                {activeUserSubTab === 'excelMerger' && (
                    <>
                        <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                            <div className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.25]">
                                <div className="absolute -top-24 -left-24 size-80 rounded-full bg-primary/25 blur-3xl" />
                                <div className="absolute -bottom-28 -right-28 size-96 rounded-full bg-emerald-400/30 blur-3xl" />
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.12)_1px,transparent_1px)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(226,232,240,0.08)_1px,transparent_1px)] [background-size:18px_18px]" />
                            </div>

                            <div className="relative px-6 py-8 sm:px-10 sm:py-10">
                                <div className="flex items-start justify-between gap-6">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-sm">
                                                <span className="material-symbols-outlined text-[22px]">library_add</span>
                                            </div>
                                            <div className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                                                <span className="text-slate-900 dark:text-white">Excel</span>
                                                <span className="text-primary">Merger</span>{" "}
                                                <span className="text-slate-900 dark:text-white">Pro</span>
                                            </div>
                                        </div>

                                        <h3 className="mt-6 text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                                            Sloučení listů <span className="text-primary">Excel</span> do jednoho výstupu
                                        </h3>
                                        <p className="mt-4 max-w-2xl text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                                            Načtěte Excel, vyberte listy a spojte do jednoho listu. Můžete přidat hlavičku, ukotvit ji a klidně přidat filtry.
                                        </p>

                                        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
                                            <div className="hidden md:block" />

                                            <div className="flex flex-wrap justify-center gap-3">
                                                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 backdrop-blur">
                                                    <span className="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400">verified_user</span>
                                                    Lokální zpracování
                                                </div>
                                                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 backdrop-blur">
                                                    <span className="material-symbols-outlined text-[18px] text-amber-600 dark:text-amber-400">info</span>
                                                    Makra (.xlsm) se nemusí zachovat
                                                </div>
                                                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 backdrop-blur">
                                                    <span className="material-symbols-outlined text-[18px] text-primary">description</span>
                                                    .xlsx & .xlsm
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-center md:justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsExcelMergerAddressSettingsOpen((v) => !v)}
                                                    aria-expanded={isExcelMergerAddressSettingsOpen}
                                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white/80 dark:bg-white/10 border border-slate-200/70 dark:border-white/10 px-4 py-2 text-sm font-bold text-slate-900 dark:text-white hover:bg-white dark:hover:bg-white/15 transition"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">settings</span>
                                                    Nastavení
                                                </button>
                                                <a
                                                    href={excelMergerMirrorUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    aria-label="Otevřít v nové kartě"
                                                    title="Otevřít v nové kartě"
                                                    className="inline-flex items-center justify-center size-10 rounded-xl bg-white/80 dark:bg-white/10 border border-slate-200/70 dark:border-white/10 text-slate-900 dark:text-white hover:bg-white dark:hover:bg-white/15 transition"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                                                    <span className="sr-only">Otevřít v nové kartě</span>
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 space-y-3">
                                    {isExcelMergerAddressSettingsOpen && (
                                        <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4">
                                            <div className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                                                ExcelMerger Pro je prolinkovaný do této aplikace. Otevře se ve vestavěném okně. Vložte adresu na které běží tool.
                                            </div>
                                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                                                Adresa ExcelMerger Pro (např. <span className="font-mono">http://localhost:8080</span>)
                                            </label>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <input
                                                    value={excelMergerMirrorUrlDraft}
                                                    onChange={(e) => setExcelMergerMirrorUrlDraft(e.target.value)}
                                                    placeholder={defaultExcelMergerMirrorUrl}
                                                    className="min-w-[260px] flex-1 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                                                />
                                                <button
                                                    onClick={() => {
                                                        const normalized = normalizeExternalUrl(excelMergerMirrorUrlDraft);
                                                        if (!normalized) {
                                                            localStorage.removeItem(EXCEL_MERGER_MIRROR_URL_STORAGE_KEY);
                                                            setExcelMergerMirrorUrlOverride('');
                                                            setExcelMergerMirrorUrlDraft('');
                                                            return;
                                                        }
                                                        try {
                                                            new URL(normalized, window.location.origin);
                                                        } catch {
                                                            alert('Neplatná adresa. Zadejte prosím URL ve formátu např. http://localhost:8080');
                                                            return;
                                                        }
                                                        localStorage.setItem(EXCEL_MERGER_MIRROR_URL_STORAGE_KEY, normalized);
                                                        setExcelMergerMirrorUrlOverride(normalized);
                                                    }}
                                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-4 py-2.5 text-sm font-bold hover:opacity-90 transition"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">save</span>
                                                    Uložit
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        localStorage.removeItem(EXCEL_MERGER_MIRROR_URL_STORAGE_KEY);
                                                        setExcelMergerMirrorUrlOverride('');
                                                        setExcelMergerMirrorUrlDraft('');
                                                    }}
                                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/80 dark:bg-white/10 border border-slate-200/70 dark:border-white/10 px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-white hover:bg-white dark:hover:bg-white/15 transition"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                                                    Reset
                                                </button>
                                            </div>
                                            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                Aktuálně načítám: <span className="font-mono">{excelMergerMirrorUrl}</span>
                                            </div>
                                        </div>
                                    )}

                                    <ExcelMergerMirror />

                                    <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                        Pokud se obsah nenačte, zkontrolujte prosím, že hostovaná aplikace povoluje vložení do iframe (CSP/X-Frame-Options).
                                    </div>
                                </div>
                            </div>
                        </section>
                    </>
                )}
                </div>
            )}


            </div>
        </div>
    );
};
