/**
 * On-screen Czech copy for the 15s Instagram Reel.
 * CTA is the marketing-confirmed landing wording: Czech www host only.
 */
export const CTA = {
  primary: "Domluvit ukázku",
  url: "tenderflow.cz",
  href: "https://www.tenderflow.cz",
} as const;

export const TAGLINE = "Jedna cesta v jednom nástroji.";

export const PRODUCT_NAME = "Tender Flow";
export const PERSONA_KICKER = "Pro přípraváře a VŘ";

export const SCENES = [
  {
    id: "kategorie",
    startSeconds: 0,
    endSeconds: 2.5,
    kicker: "Kategorie",
    title: "Příprava a VŘ",
    subtitle: "Tendry. Nabídky. Smlouva.",
    cards: [
      { label: "Tendr", detail: "Zadání drží pohromadě" },
      { label: "Nabídky", detail: "Uchazeči na jednom místě" },
      { label: "Smlouva", detail: "Stejná cesta až k podpisu" },
    ],
  },
  {
    id: "oslovení",
    startSeconds: 2.5,
    endSeconds: 5,
    kicker: "Uchazeči",
    title: "Oslovení uchazečů",
    subtitle: "Koho oslovit. Přehledně.",
    rows: [
      { name: "Voda-Tech", role: "ZTI", state: "Osloven" },
      { name: "Instal Pro", role: "ZTI", state: "Osloven" },
      { name: "Moravia Pipe", role: "ZTI", state: "K oslovení" },
    ],
  },
  {
    id: "kola",
    startSeconds: 5,
    endSeconds: 8.5,
    kicker: "Nabídky",
    title: "Kola nabídek",
    subtitle: "Další kolo bez ztráty kontextu.",
    rounds: [
      { name: "Kolo 1", status: "Uzavřeno", count: "3 nabídky" },
      { name: "Kolo 2", status: "Běží", count: "Čeká se" },
    ],
  },
  {
    id: "vyber",
    startSeconds: 8.5,
    endSeconds: 11.5,
    kicker: "Rozhodnutí",
    title: "Výběr nabídky",
    subtitle: "Rozhodnutí zůstane u zakázky.",
    offers: [
      { vendor: "Voda-Tech", note: "Doplněno", selected: false },
      { vendor: "Instal Pro", note: "Vybráno", selected: true },
      { vendor: "Moravia Pipe", note: "Náhradní", selected: false },
    ],
  },
  {
    id: "smlouva",
    startSeconds: 11.5,
    endSeconds: 15,
    kicker: "Uzavření",
    title: "Smlouva",
    subtitle: TAGLINE,
  },
] as const;

export const DEMO_PROJECT = {
  name: "Rekonstrukce školy",
  category: "ZTI",
} as const;

export const FORBIDDEN_COPY_FRAGMENTS = [
  "výkaz výměr",
  "soupis",
  "položkov",
  "kalkulac",
  "helios",
  "first rsv",
  "erp",
  "tenderflow.de",
  "app.tenderflow",
] as const;
