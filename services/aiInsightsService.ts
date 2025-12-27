import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini - API key from .env as VITE_GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

interface ProjectSummary {
  name: string;
  totalBudget: number;
  totalContracted: number;
  categoriesCount: number;
  sodCount: number;
  balance: number;
  // Optional expanded fields for deep analysis
  totalPlanned?: number;
  balanceVsPlan?: number;
  categoriesData?: {
    title: string;
    plan: number;
    sod: number;
    diff: number;
    status: string;
  }[];
}

export interface AIInsight {
  title: string;
  content: string;
  type: 'success' | 'warning' | 'info' | 'tip' | 'achievement' | 'chart';
  icon: string;
  progress?: number; // 0-100 for progress bar
  stats?: { label: string; value: string; trend?: 'up' | 'down' | 'neutral' }[];
  achievement?: { level: number; maxLevel: number; label: string };
  chartData?: { label: string; value: number; color?: string }[];
  chartType?: 'bar' | 'pie' | 'progress';
}

// Random seed for variety in responses
const getRandomSeed = () => Math.floor(Math.random() * 1000);

export const generateProjectInsights = async (projects: ProjectSummary[], mode: 'achievements' | 'charts' | 'reports' | 'contacts' | 'overview' = 'achievements'): Promise<AIInsight[]> => {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    return [{
      title: 'API klíč nenalezen',
      content: 'Pro AI analýzu přidejte VITE_GEMINI_API_KEY do .env souboru.',
      type: 'warning',
      icon: 'warning'
    }];
  }

  try {
    // Use specific model version for better stability
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });

    const projectsSummary = projects.map(p => ({
      název: p.name,
      rozpočet: p.totalBudget,
      náklady: p.totalContracted,
      bilance: p.balance,
      kategorií: p.categoriesCount,
      uzavřených: p.sodCount,
      marže: p.totalBudget > 0 ? ((p.balance / p.totalBudget) * 100).toFixed(1) + '%' : '0%',
      // Add details if available
      ...(p.categoriesData ? {
        detail_kategorií: p.categoriesData.map(c => ({
          kategorie: c.title,
          plán: c.plan,
          sod: c.sod,
          rozdíl: c.diff
        }))
      } : {})
    }));

    const totalBudget = projects.reduce((s, p) => s + p.totalBudget, 0);
    const totalCosts = projects.reduce((s, p) => s + p.totalContracted, 0);
    const totalBalance = totalBudget - totalCosts;
    const totalCategories = projects.reduce((s, p) => s + p.categoriesCount, 0);
    const totalSod = projects.reduce((s, p) => s + p.sodCount, 0);
    const avgMargin = totalBudget > 0 ? (totalBalance / totalBudget) * 100 : 0;
    const sodProgress = totalCategories > 0 ? (totalSod / totalCategories) * 100 : 0;

    // Default Prompts (Fallbacks)
    const DEFAULT_ACHIEVEMENTS_PROMPT = `Jsi kreativní analytik stavebních projektů. Vygeneruj 4-5 UNIKÁTNÍCH achievement-style insights ve stylu herních úspěchů. Buď kreativní - každé volání má být jiné!

SEED PRO VARIACI: ${getRandomSeed()}

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

PŘÍKLADY NÁZVŮ: "💰 Mistr úspor", "🏆 SOD Champion", "📊 Analytik měsíce", "🚀 Speed Builder"

TYPY INSIGHTS (vyber mix):
1. Achievement s levelem (achievement type)
2. Progress bar insight (s progress hodnotou)
3. Stats insight (se stats polem)  
4. Klasický tip nebo varování

Buď VELMI kreativní a každou odpověď udělej UNIKÁTNÍ!`;

    const DEFAULT_CHARTS_PROMPT = `Jsi dlouholetý manažer se znalostmi vedení staveb a jejich provádění. Máš skvělé analytické schopnosti a proto si generuješ různá data, která by ti mohla v grafické podobě napomáhat analyzovat a mít přehled o stavbě a jejích součástí.

Vygeneruj 3-4 datové vizualizace/grafy pro dashboard. Každá vizualizace musí mít chartData s číselnými hodnotami.

SEED PRO VARIACI: ${getRandomSeed()}

Odpověz POUZE jako JSON pole s grafy:
{
  "title": "Název grafu (stručný, výstižný)",
  "content": "Krátký popis co graf ukazuje a proč je důležitý",
  "type": "chart",
  "icon": "bar_chart|pie_chart|show_chart|analytics",
  "chartType": "bar|pie|progress",
  "chartData": [{ "label": "Název položky", "value": číslo, "color": "#hexcolor" }]
}

TYPY GRAFŮ: bar, pie, progress
Použij barvy: #10B981 (zelená-zisk), #F59E0B (oranžová-varování), #3B82F6 (modrá-neutrální), #8B5CF6 (fialová), #EF4444 (červená-ztráta)

Generuj grafy které jsou PRAKTICKÉ a užitečné pro každodenní rozhodování stavebního manažera!`;

    const DEFAULT_REPORTS_PROMPT = `Jsi zkušený stavbyvedoucí a projektový manažer. Připravuješ přehledné reporty o stavu projektů pro vedení firmy a investory.

SEED PRO VARIACI: ${getRandomSeed()}

Vygeneruj 3-4 reportovací položky. Mohou být různého typu:
{
  "title": "Název sekce reportu",
  "content": "Stručný text reportu (2-3 věty, klíčové informace pro management)",
  "type": "info|success|warning|tip",
  "icon": "summarize|assessment|analytics|report|trending_up|trending_down|warning|check_circle",
  "stats": [{ "label": "Metrika", "value": "Hodnota", "trend": "up|down|neutral" }]
}

TYPY REPORTŮ: Shrnutí stavu, Finanční přehled, Upozornění, Doporučení.
Piš profesionálně ale srozumitelně. Report by měl být užitečný pro rychlé rozhodování vedení!`;

    const DEFAULT_CONTACTS_PROMPT = `Jsi analytik subdodavatelů ve stavební firmě. Analyzuješ výkonnost a spolehlivost subdodavatelů na základě dat z výběrových řízení.

SEED PRO VARIACI: ${getRandomSeed()}

Vygeneruj 4-5 insights o subdodavatelích/kontaktech. Zaměř se na:
- Nejčastější subdodavatelé (podle účasti v poptávkách)
- Nejlepší subdodavatelé (podle cenové konkurenceschopnosti)
- Průměrné umístění subdodavatelů v soutěžích
- Trendy v nabídkách (počet oslovených vs. počet odevzdaných cen)
- Doporučení pro budoucí poptávání

Odpověz POUZE jako JSON pole:
{
  "title": "Název insight",
  "content": "Stručný popis (max 100 znaků)",
  "type": "achievement|success|warning|info|tip",
  "icon": "person|group|star|trending_up|analytics|leaderboard|handshake|verified",
  "progress": 0-100 (volitelné),
  "stats": [{ "label": "Metrika", "value": "Hodnota", "trend": "up|down|neutral" }] (volitelné, max 2)
}

Buď kreativní a generuj PRAKTICKÉ insights pro výběr nejlepších subdodavatelů!`;

    const DEFAULT_OVERVIEW_PROMPT = `Jsi zkušený stavební analytik a projektový manažer. Na základě níže uvedených dat z výběrových řízení vytvoř detailní manažerské hodnocení projektu.

SEED PRO VARIACI: ${getRandomSeed()}

### Kontext:
Údaje představují výsledky výběrových řízení na jednotlivé části stavby (subdodávky, materiály, služby). Data obsahují:
- Názvy položek nebo zakázek a jejich finanční hodnoty
- Nabídnuté ceny a rozdíly vůči rozpočtu
- Počty nabídek a úspěšnost výběrových řízení
- Stav uzavření smluv (SOD)

### Úkol:
Vygeneruj komplexní slovní hodnocení projektu z pohledu:

1. FINANČNÍ ANALÝZA
Srovnej nabídkové ceny s rozpočtem, identifikuj úspory nebo překročení, uveď míru konkurence a efektivitu výběrových řízení.
Pokud jsou dostupná detailní data o kategoriích, buď konkrétní (např. "V kategorii X došlo k úspoře Y Kč").

2. SMLUVNÍ A PROCESNÍ STAV
Zhodnoť postup uzavírání smluv, počet dokončených vs. otevřených poptávek, identifikuj případná rizika v procesu.

3. DODAVATELSKÁ SITUACE
Popiš celkovou situaci s dodavateli - počet nabídek na poptávku, konkurenceschopnost trhu, případné problémy s nedostatkem nabídek.

4. CELKOVÉ ŘÍZENÍ PROJEKTU
Shrň, jak výběrová řízení ovlivnila celkové řízení stavby, ekonomiku projektu a další fáze.

### KRITICKY DŮLEŽITÉ - Formát výstupu:
- NIKDY nepoužívej JSON formát
- NIKDY nepoužívej hvězdičky ** pro tučný text
- NIKDY nepoužívej markdown značky jako # nebo \`\`\`
- Piš POUZE čistý plný text bez jakéhokoliv formátování
- Nadpisy sekcí piš jako: "1. FINANČNÍ ANALÝZA" (bez hvězdiček)
- Používej pomlčky - pro odrážky
- Formulace typu: "Z finančního hlediska lze konstatovat...", "Analýza ukázala..."
- Na konci přidej SHRNUTÍ A DOPORUČENÍ pro další postup
- Délka: 300-500 slov`;

    // Data Context Construction - different ending for overview mode
    const dataContextBase = `

DATA O STAVBÁCH:
- Celkový rozpočet: ${totalBudget.toLocaleString('cs-CZ')} Kč
- Celkové náklady subdodavatelů: ${totalCosts.toLocaleString('cs-CZ')} Kč  
- Bilance (zisk/ztráta): ${totalBalance.toLocaleString('cs-CZ')} Kč
- Průměrná marže: ${avgMargin.toFixed(1)}%
- Postup uzavírání SOD: ${sodProgress.toFixed(0)}% (${totalSod} z ${totalCategories} kategorií)
- Počet aktivních staveb: ${projects.length}

DETAIL STAVEB:
${JSON.stringify(projectsSummary, null, 2)}`;

    // Load prompt based on mode
    let basePrompt = '';

    if (typeof localStorage !== 'undefined') {
      if (mode === 'achievements') {
        basePrompt = localStorage.getItem('aiPromptAchievements') || DEFAULT_ACHIEVEMENTS_PROMPT;
      } else if (mode === 'charts') {
        basePrompt = localStorage.getItem('aiPromptCharts') || DEFAULT_CHARTS_PROMPT;
      } else if (mode === 'reports') {
        basePrompt = localStorage.getItem('aiPromptReports') || DEFAULT_REPORTS_PROMPT;
      } else if (mode === 'contacts') {
        const storedPrompt = localStorage.getItem('aiPromptContacts');
        basePrompt = (storedPrompt && storedPrompt.trim()) ? storedPrompt : DEFAULT_CONTACTS_PROMPT;
      } else if (mode === 'overview') {
        const storedPrompt = localStorage.getItem('aiPromptOverview');
        basePrompt = (storedPrompt && storedPrompt.trim()) ? storedPrompt : DEFAULT_OVERVIEW_PROMPT;
      }
    } else {
      // Fallback if localStorage is not available
      if (mode === 'achievements') basePrompt = DEFAULT_ACHIEVEMENTS_PROMPT;
      else if (mode === 'charts') basePrompt = DEFAULT_CHARTS_PROMPT;
      else if (mode === 'reports') basePrompt = DEFAULT_REPORTS_PROMPT;
      else if (mode === 'contacts') basePrompt = DEFAULT_CONTACTS_PROMPT;
      else if (mode === 'overview') basePrompt = DEFAULT_OVERVIEW_PROMPT;
    }

    // For overview mode, don't add JSON instruction
    const dataContext = mode === 'overview'
      ? dataContextBase + '\n\nVYPIŠ POUZE ČISTÝ TEXT S MARKDOWN FORMÁTOVÁNÍM, NIKDY NE JSON!'
      : dataContextBase + '\n\nOdpověz POUZE jako JSON pole.';

    const prompt = basePrompt + dataContext;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // For overview mode, return the text directly (not JSON)
    if (mode === 'overview') {
      // Aggressively clean up any JSON/markdown artifacts
      let cleanText = text
        // Remove code blocks
        .replace(/```[^\n]*\n[\s\S]*?```/g, '')
        .replace(/`/g, '')
        // Remove JSON-like patterns but keep normal text
        .replace(/^\s*\{\s*"[^"]+"\s*:/gm, '')
        .replace(/^\s*\[\s*\{/gm, '')
        .replace(/\}\s*\]\s*$/gm, '')
        .replace(/^\s*"[^"]+"\s*:\s*"/gm, '')
        // Remove markdown formatting
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#{1,6}\s*/g, '')
        // Clean up escaped characters
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '')
        // Remove stray characters
        .replace(/^[\[\]{},"\s]+$/gm, '')
        .replace(/^\s*,\s*$/gm, '')
        // Remove empty lines and extra whitespace
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      return [{
        title: 'AI Analýza projektu',
        content: cleanText,
        type: 'info',
        icon: 'analytics'
      }];
    }

    // Parse JSON from response for other modes
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const insights: AIInsight[] = JSON.parse(jsonMatch[0]);
      return insights;
    }

    return [{
      title: 'Analýza dokončena',
      content: text.slice(0, 500),
      type: 'info',
      icon: 'insights'
    }];
  } catch (error) {
    console.error('Gemini API error:', error);
    return [{
      title: 'Chyba při analýze',
      content: 'Nepodařilo se získat AI insights. Zkuste to později.',
      type: 'warning',
      icon: 'error'
    }];
  }
};

// Local insights when API is not available
export const generateLocalInsights = (projects: ProjectSummary[]): AIInsight[] => {
  const insights: AIInsight[] = [];

  const totalBudget = projects.reduce((s, p) => s + p.totalBudget, 0);
  const totalCosts = projects.reduce((s, p) => s + p.totalContracted, 0);
  const totalBalance = totalBudget - totalCosts;
  const avgMargin = totalBudget > 0 ? (totalBalance / totalBudget) * 100 : 0;

  // Margin insight
  if (avgMargin > 15) {
    insights.push({
      title: 'Výborná marže',
      content: `Průměrná marže ${avgMargin.toFixed(1)}% je nad standardem.`,
      type: 'success',
      icon: 'trending_up'
    });
  } else if (avgMargin < 5) {
    insights.push({
      title: 'Nízká marže',
      content: `Marže ${avgMargin.toFixed(1)}% je pod optimem 10%.`,
      type: 'warning',
      icon: 'warning'
    });
  }

  // Project with best margin
  const bestProject = projects.reduce((best, p) => {
    const margin = p.totalBudget > 0 ? ((p.balance) / p.totalBudget) * 100 : 0;
    const bestMargin = best?.totalBudget > 0 ? ((best.balance) / best.totalBudget) * 100 : 0;
    return margin > bestMargin ? p : best;
  }, projects[0]);

  if (bestProject) {
    const bestMargin = bestProject.totalBudget > 0
      ? ((bestProject.balance) / bestProject.totalBudget) * 100
      : 0;
    insights.push({
      title: 'Nejziskovější projekt',
      content: `${bestProject.name} má marži ${bestMargin.toFixed(1)}%.`,
      type: 'success',
      icon: 'emoji_events'
    });
  }

  // Categories progress
  const totalCategories = projects.reduce((s, p) => s + p.categoriesCount, 0);
  const totalSod = projects.reduce((s, p) => s + p.sodCount, 0);
  const progress = totalCategories > 0 ? (totalSod / totalCategories) * 100 : 0;

  insights.push({
    title: 'Postup uzavírání SOD',
    content: `${totalSod} z ${totalCategories} kategorií má SOD (${progress.toFixed(0)}%).`,
    type: 'info',
    icon: 'checklist'
  });

  // Tip
  if (totalBalance > 0) {
    insights.push({
      title: 'Celková bilance',
      content: `Celkový zisk ${(totalBalance / 1000000).toFixed(2)} mil Kč.`,
      type: 'success',
      icon: 'savings'
    });
  }

  return insights;
};
