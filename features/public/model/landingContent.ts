import constructionSite from "@/assets/landing/construction-site.webp";
import constructionFoundations from "@/assets/landing/construction-foundations.webp";
import constructionShell from "@/assets/landing/construction-shell.webp";
import constructionFinishing from "@/assets/landing/construction-finishing.webp";
import constructionComplete from "@/assets/landing/construction-complete.webp";

export const TENDER_STORY_STEPS = [
  {
    id: "brief",
    number: "01",
    label: "Zadání",
    image: constructionSite,
    imageAlt: "Stavební pláň",
    title: "Podklady drží pohromadě od prvního dne.",
    detail: "Poptávka, výkaz výměr, termíny a odpovědnosti v jednom projektu.",
    metric: "Kompletní zadání",
  },
  {
    id: "offers",
    number: "02",
    label: "Nabídky",
    image: constructionFoundations,
    imageAlt: "Základy stavby",
    title: "Nabídky na jednom místě.",
    detail: "Porovnatelné, dohledatelné a připravené k rozhodnutí.",
    metric: "8 z 10 přijato",
  },
  {
    id: "evaluation",
    number: "03",
    label: "Vyhodnocení",
    image: constructionShell,
    imageAlt: "Hrubá stavba",
    title: "Rizika jsou vidět dřív než na stavbě.",
    detail: "Cena, termín, záruka i reference podle stejných kritérií.",
    metric: "4 kritéria",
  },
  {
    id: "decision",
    number: "04",
    label: "Rozhodnutí",
    image: constructionFinishing,
    imageAlt: "Dokončování stavby",
    title: "Rozhodnutí má jasného vlastníka.",
    detail: "Schválení, komentáře a doporučení zůstávají u zakázky.",
    metric: "1 doporučení",
  },
  {
    id: "contract",
    number: "05",
    label: "Smlouva",
    image: constructionComplete,
    imageAlt: "Hotová stavba s upraveným okolím",
    title: "Každé rozhodnutí má dohledatelnou historii.",
    detail: "Od vítězné nabídky ke smlouvě bez ztracených souvislostí.",
    metric: "Auditní stopa",
  },
] as const;

export const ENTERPRISE_FEATURE_GROUPS: ReadonlyArray<{
  title: string;
  items: ReadonlyArray<string>;
}> = [
  {
    title: "Tendry & projekty",
    items: [
      "Neomezené projekty",
      "Přehled stavby: investor, lokace, termíny a odpovědné osoby",
      "Finanční řízení: plánované náklady, smluvní ceny, dodatky a fakturace",
      "Stav výběrových řízení: otevřené kategorie, vítězné nabídky a uzavřené smlouvy",
      "Termíny, rizika a pokrytí rozpočtu napříč projekty",
      "Plán výběrových řízení a importy VŘ",
      "Harmonogram měsíc / týden / den",
      "Subdodavatelé a jejich hodnocení",
      "Sdílení projektů v týmu",
      "Archivace projektů",
      "Základní i detailní reporty",
    ],
  },
  {
    title: "Dokumenty & AI",
    items: [
      "Modul Smlouvy",
      "OCR čtení dokumentů (Mistral AI)",
      "Složkomat: automatizace složek",
      "Excel Indexace VŘ",
      "Excel Spojení listů",
      "Excel odemčení",
      "Export do Excel",
      "Export do PDF",
    ],
  },
  {
    title: "Platforma & integrace",
    items: [
      "Desktopová aplikace",
      "Automatické aktualizace v aplikaci",
      "Okamžitý přístup k novinkám",
      "Tender Flow MCP server",
      "Geokódování kontaktů",
      "Integrace mapy s kontakty",
      "Onboarding asistence",
    ],
  },
];
