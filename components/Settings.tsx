
import React, { useState } from 'react';
import { Header } from './Header';
import { Project, ProjectStatus, StatusConfig, Subcontractor } from '../types';
import { addContactStatus, updateContactStatus, deleteContactStatus } from '../services/contactStatusService';
import { UserManagement } from './UserManagement';
import { EmailWhitelistManagement } from './EmailWhitelistManagement';

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
    onSyncContacts: (url: string, onProgress?: (percent: number) => void) => Promise<void>;
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
    onSyncContacts,
    onDeleteContacts,
    contacts,
    isAdmin = false,
    onSaveSettings,
    user
}) => {


    // Status Form State
    const [newStatusLabel, setNewStatusLabel] = useState('');
    const [newStatusColor, setNewStatusColor] = useState<StatusConfig['color']>('blue');

    // Import State
    const [importedContacts, setImportedContacts] = useState<Subcontractor[]>([]);
    const [fileName, setFileName] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    // Tab State
    const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');
    const [activeUserSubTab, setActiveUserSubTab] = useState<'profile' | 'contacts'>('profile');

    // Auto-Sync State
    const [importUrl, setImportUrl] = useState(() => localStorage.getItem('contactsImportUrl') || '');
    const [lastSyncTime, setLastSyncTime] = useState(() => localStorage.getItem('contactsLastSyncTime') || '');
    const [isSyncing, setIsSyncing] = useState(false);

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

    const handleSaveUrl = () => {
        if (importUrl) {
            localStorage.setItem('contactsImportUrl', importUrl);
            alert('URL uložena.');
        }
    };

    const handleSyncNow = async () => {
        if (!importUrl) {
            alert('Prosím zadejte URL souboru.');
            return;
        }

        setIsSyncing(true);
        setUploadProgress(0);
        try {
            await onSyncContacts(importUrl, (p) => setUploadProgress(p));
            const now = new Date().toLocaleString('cs-CZ');
            setLastSyncTime(now);
            localStorage.setItem('contactsLastSyncTime', now);
        } catch (error) {
            console.error('Sync failed:', error);
        } finally {
            setIsSyncing(false);
            setUploadProgress(0);
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

    // Import Logic
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setFileName(file.name);

            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                parseCSV(text);
            };
            reader.readAsText(file);
        }
    };

    const parseCSV = (csvText: string) => {
        // Simple CSV parser
        // Assumes format: Firma, Jméno, Specializace, Telefon, Email, IČO, Region
        const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
        const parsed: Subcontractor[] = [];

        // Skip header if it looks like one
        const startIndex = lines[0].toLowerCase().includes('firma') ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            // Handle basic comma or semicolon separation
            const separator = lines[i].includes(';') ? ';' : ',';
            const cols = lines[i].split(separator).map(c => c.trim());

            if (cols.length >= 3) {
                parsed.push({
                    id: `imp_${Date.now()}_${i}`,
                    company: cols[0] || 'Neznámá firma',
                    name: cols[1] || '-',
                    specialization: [cols[2] || 'Ostatní'], // Changed to array
                    phone: cols[3] || '-',
                    email: cols[4] || '-',
                    ico: cols[5] || '-',
                    region: cols[6] || '-',
                    status: 'available', // Default status
                    contacts: []
                });
            }
        }
        setImportedContacts(parsed);
    };

    const handleConfirmImport = async () => {
        if (importedContacts.length > 0) {
            setIsUploading(true);
            setUploadProgress(0);
            try {
                await onImportContacts(importedContacts, (percent) => setUploadProgress(percent));
                setImportedContacts([]);
                setFileName('');
            } catch (error) {
                console.error("Import failed", error);
            } finally {
                setIsUploading(false);
                setUploadProgress(0);
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen overflow-y-auto">
            <Header title="Nastavení" subtitle="Konfigurace aplikace a správa staveb" />

                <div className="p-6 lg:p-10 max-w-5xl mx-auto w-full pb-20">

                {/* Tab Navigation */}
                <div className="flex items-center gap-4 mb-8 border-b border-slate-200 dark:border-slate-700/50">
                    <button
                        onClick={() => setActiveTab('user')}
                        className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'user'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        Nastavení uživatele
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => setActiveTab('admin')}
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
                                onClick={() => setActiveUserSubTab('profile')}
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
                                onClick={() => setActiveUserSubTab('contacts')}
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

                    {/* Auto-Sync from URL */}
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3 mb-4">
                            <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">sync</span>
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-purple-900 dark:text-purple-100 mb-1">Synchronizace kontaktů z URL</h3>
                                <p className="text-xs text-purple-700 dark:text-purple-300 mb-3">
                                    Zadejte odkaz na CSV/XLSX soubor (např. Google Sheets export link).
                                    Synchronizaci spustíte tlačítkem níže.
                                </p>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-purple-700 dark:text-purple-300 mb-1 font-medium">URL souboru</label>
                                        <input
                                            type="url"
                                            value={importUrl}
                                            onChange={(e) => setImportUrl(e.target.value)}
                                            placeholder="https://docs.google.com/spreadsheets/.../export?format=csv"
                                            className="w-full rounded-lg bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                                        />
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleSaveUrl}
                                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm"
                                        >
                                            Uložit URL
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSyncNow}
                                            disabled={isSyncing || !importUrl}
                                            className="bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="flex items-center gap-2">
                                                <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                                                {isSyncing ? 'Synchronizuji...' : 'Synchronizovat nyní'}
                                            </span>
                                        </button>
                                    </div>

                                    {isSyncing && (
                                        <div className="flex items-center gap-4 mt-2">
                                            <div className="flex-1 h-2 bg-purple-200 dark:bg-purple-900/50 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-purple-600 transition-all duration-300 ease-out"
                                                    style={{ width: `${uploadProgress}%` }}
                                                />
                                            </div>
                                            <span className="text-sm font-bold text-purple-700 dark:text-purple-300 whitespace-nowrap">
                                                {uploadProgress}%
                                            </span>
                                        </div>
                                    )}

                                    <p className="text-xs text-purple-600 dark:text-purple-400 italic">
                                        💡 Poslední synchronizace: {lastSyncTime || 'Ještě nebyla provedena'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Manual File Upload */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <span className="material-symbols-outlined text-[20px]">info</span>
                            <span>Nebo nahrajte soubor jednorázově:</span>
                        </div>

                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Nahrajte CSV soubor pro hromadný import kontaktů. <br />
                            <span className="text-xs italic">Formát: Firma, Jméno, Specializace, Telefon, Email, IČO, Region</span>
                        </p>

                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                            <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700">
                                <span className="material-symbols-outlined">folder_open</span>
                                {fileName || 'Vybrat soubor CSV'}
                                <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                            </label>

                            {importedContacts.length > 0 && !isUploading && (
                                <div className="flex items-center gap-4 flex-1">
                                    <span className="text-sm font-medium text-green-600">
                                        Nalezeno {importedContacts.length} kontaktů
                                    </span>
                                    <button
                                        onClick={handleConfirmImport}
                                        className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm"
                                    >
                                        Importovat do databáze
                                    </button>
                                </div>
                            )}

                            {isUploading && (
                                <div className="flex-1 flex items-center gap-4">
                                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-300 ease-out"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-bold text-primary whitespace-nowrap">
                                        {uploadProgress}%
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
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
                </div>
            )}


            </div>
        </div>
    );
};
