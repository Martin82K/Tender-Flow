import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

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

interface AISettingsProps {
    isAdmin: boolean;
}

export const AISettings: React.FC<AISettingsProps> = ({ isAdmin }) => {
    // AI Settings State (Admin only) - localStorage
    const [aiEnabled, setAiEnabled] = useState(() => {
        const stored = localStorage.getItem('aiEnabled');
        return stored !== 'false'; // Default to true
    });

    const [promptContacts, setPromptContacts] = useState(() =>
        localStorage.getItem('aiPromptContacts') || ''
    );
    const [promptOverview, setPromptOverview] = useState(() =>
        localStorage.getItem('aiPromptOverview') || DEFAULT_PROMPT_OVERVIEW
    );

    const [promptsSaved, setPromptsSaved] = useState(false);

    // Initialize localStorage with defaults if empty
    useEffect(() => {
        if (!localStorage.getItem('aiPromptContacts')) {
            localStorage.setItem('aiPromptContacts', '');
        }
        if (!localStorage.getItem('aiPromptOverview')) {
            localStorage.setItem('aiPromptOverview', DEFAULT_PROMPT_OVERVIEW);
        }
    }, []);

    // Save AI setting to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('aiEnabled', aiEnabled.toString());
    }, [aiEnabled]);

    const [googleKey, setGoogleKey] = useState('');
    const [openRouterKey, setOpenRouterKey] = useState('');
    const [isGoogleKeySet, setIsGoogleKeySet] = useState(false);
    const [isOpenRouterKeySet, setIsOpenRouterKeySet] = useState(false);
    const [secretsSaved, setSecretsSaved] = useState(false);

    // Load secret status (not values)
    useEffect(() => {
        const checkSecrets = async () => {
            const { data, error } = await supabase
                .from('app_secrets')
                .select('google_api_key, openrouter_api_key')
                .eq('id', 'default')
                .single();

            if (data) {
                setIsGoogleKeySet(!!data.google_api_key && data.google_api_key.length > 0);
                setIsOpenRouterKeySet(!!data.openrouter_api_key && data.openrouter_api_key.length > 0);
            }
        };
        checkSecrets();
    }, []);

    const saveSecrets = async () => {
        const updates: any = { id: 'default', updated_at: new Date().toISOString() };
        if (googleKey.trim()) updates.google_api_key = googleKey.trim();
        if (openRouterKey.trim()) updates.openrouter_api_key = openRouterKey.trim();

        if (Object.keys(updates).length <= 2) {
            // Nothing to update
            return;
        }

        const { error } = await supabase
            .from('app_secrets')
            .upsert(updates, { onConflict: 'id' });

        if (error) {
            console.error('Error saving secrets:', error);
            alert('Chyba při ukládání klíčů.');
        } else {
            setGoogleKey('');
            setOpenRouterKey('');
            setSecretsSaved(true);
            setTimeout(() => setSecretsSaved(false), 3000);

            // Refresh status
            if (updates.google_api_key) setIsGoogleKeySet(true);
            if (updates.openrouter_api_key) setIsOpenRouterKeySet(true);
        }
    };

    const savePrompts = () => {
        localStorage.setItem('aiPromptContacts', promptContacts);
        localStorage.setItem('aiPromptOverview', promptOverview);
        setPromptsSaved(true);
        setTimeout(() => setPromptsSaved(false), 3000);
    };

    if (!isAdmin) return null;

    return (
        <section className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl mb-8 animate-fadeIn">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-violet-400">auto_awesome</span>
                Nastavení AI funkcí
                <span className="ml-2 px-2.5 py-1 bg-violet-500/20 text-violet-400 text-xs font-bold rounded-lg border border-violet-500/30">Admin</span>
            </h2>

            <div className="flex items-center justify-between mb-8">
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

            {aiEnabled && (
                <div className="space-y-8">
                    {/* API Keys Management */}
                    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h3 className="text-md font-bold text-slate-900 dark:text-white pb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-indigo-400">vpn_key</span>
                            API Klíče (System Secret Storage)
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">
                            Zde uložené klíče jsou bezpečně uloženy v databázi a používají se automaticky, pokud uživatel neposkytne vlastní klíč.
                            <br />Klíče se po uložení <b>nezobrazují</b> (jsou skryty bezpečnostní politikou).
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex justify-between">
                                    <span>Google Gemini API Key</span>
                                    {isGoogleKeySet ?
                                        <span className="text-emerald-500 text-xs font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">check_circle</span> Nastaveno</span> :
                                        <span className="text-slate-400 text-xs flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">cancel</span> Nenastaveno</span>
                                    }
                                </label>
                                <input
                                    type="password"
                                    value={googleKey}
                                    onChange={(e) => setGoogleKey(e.target.value)}
                                    placeholder={isGoogleKeySet ? "●●●●●●●●●●●● (Klíč je uložen)" : "Vložte nový API klíč..."}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-indigo-500 dark:text-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex justify-between">
                                    <span>OpenRouter API Key</span>
                                    {isOpenRouterKeySet ?
                                        <span className="text-emerald-500 text-xs font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">check_circle</span> Nastaveno</span> :
                                        <span className="text-slate-400 text-xs flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">cancel</span> Nenastaveno</span>
                                    }
                                </label>
                                <input
                                    type="password"
                                    value={openRouterKey}
                                    onChange={(e) => setOpenRouterKey(e.target.value)}
                                    placeholder={isOpenRouterKeySet ? "●●●●●●●●●●●● (Klíč je uložen)" : "Vložte nový API klíč..."}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-indigo-500 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            {secretsSaved && (
                                <span className="text-emerald-500 text-sm font-medium flex items-center gap-1 animate-fadeIn mr-4">
                                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                    Klíče uloženy
                                </span>
                            )}
                            <button
                                onClick={saveSecrets}
                                disabled={!googleKey && !openRouterKey}
                                className={`px-4 py-2 rounded-lg font-bold text-sm shadow-lg transition-all flex items-center gap-2 ${(!googleKey && !openRouterKey) ?
                                    'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed' :
                                    'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[18px]">lock</span>
                                Uložit klíče do trezoru
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h3 className="text-md font-bold text-slate-900 dark:text-white pb-2">
                            Prompt Engineering
                        </h3>

                        {/* Overview Prompt */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Prompt pro Project Overview
                                </label>
                                <button
                                    onClick={() => setPromptOverview(DEFAULT_PROMPT_OVERVIEW)}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
                                >
                                    Obnovit výchozí
                                </button>
                            </div>
                            <textarea
                                value={promptOverview}
                                onChange={(e) => setPromptOverview(e.target.value)}
                                rows={15}
                                className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 p-3 text-xs font-mono text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent leading-relaxed"
                            />
                        </div>

                        {/* Contacts Prompt (reserved) */}
                        <div className="space-y-2 opacity-50 pointer-events-none filter grayscale">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Prompt pro Contacts Assistant (Připravujeme)
                            </label>
                            <textarea
                                value={promptContacts}
                                onChange={(e) => setPromptContacts(e.target.value)}
                                rows={3}
                                placeholder="Zde bude možné upravit prompt pro AI asistenta v kontaktech..."
                                className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 p-3 text-xs font-mono text-slate-600 dark:text-slate-300"
                                disabled
                            />
                        </div>

                        <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            {promptsSaved && (
                                <span className="text-emerald-500 text-sm font-medium flex items-center gap-1 animate-fadeIn">
                                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                    Prompty uloženy
                                </span>
                            )}
                            <button
                                onClick={savePrompts}
                                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold shadow-lg transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">save</span>
                                Uložit prompty
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};
