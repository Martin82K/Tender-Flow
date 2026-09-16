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
  name: "Rekonstrukce ZŠ Javor",
  status: "V soutěži",
  category: "ZTI",
  code: "STV-2026-041",
} as const;

export const DEMO_CATEGORIES = [
  {
    title: "ZTI",
    status: "Poptávání",
    tone: "open",
    asked: "6",
    offers: "3",
    description: "Rozvody vody, kanalizace a topení v objektu školy.",
    deadline: "24. 4. 2026",
    priceLabel: "Cena SOD (Investor)",
    price: "1 250 000 Kč",
  },
  {
    title: "Elektroinstalace",
    status: "Vyjednávání",
    tone: "negotiating",
    asked: "5",
    offers: "4",
    description: "Silnoproud a osvětlení učeben, chodeb a jídelny.",
    deadline: "18. 4. 2026",
    priceLabel: "Cena SOD (Investor)",
    price: "860 000 Kč",
  },
  {
    title: "Omítky",
    status: "Uzavřeno",
    tone: "closed",
    asked: "4",
    offers: "4",
    description: "Vnitřní omítky po bouracích pracích v pavilonu A.",
    deadline: "2. 3. 2026",
    priceLabel: "Vítězná cena",
    price: "540 000 Kč",
  },
  {
    title: "VZT",
    status: "V Realizaci",
    tone: "closed",
    asked: "3",
    offers: "3",
    description: "Výměna vzduchotechniky v jídelně a tělocvičně.",
    deadline: "10. 2. 2026",
    priceLabel: "Vítězná cena",
    price: "720 000 Kč",
    contracts: "1/1",
  },
] as const;

export const DEMO_BIDS = [
  {
    company: "Voda-Tech s.r.o.",
    person: "Petr Nový",
    email: "petr.novy@voda-tech.cz",
    phone: "+420 777 214 090",
    column: "Oslovení",
    rounds: [
      { label: "Soutěž", price: "1 310 000 Kč" },
      { label: "1. kolo", price: "1 248 000 Kč" },
    ],
    selectedRound: 1,
  },
  {
    company: "Instal Pro s.r.o.",
    person: "Jana Malá",
    email: "jana@instalpro.cz",
    phone: "+420 603 118 442",
    column: "Jednání o SOD",
    rounds: [
      { label: "Soutěž", price: "1 275 000 Kč" },
      { label: "1. kolo", price: "1 220 000 Kč" },
      { label: "2. kolo", price: "1 190 000 Kč" },
    ],
    selectedRound: 2,
    winner: true,
  },
  {
    company: "Moravia Pipe a.s.",
    person: "Lukáš Dvořák",
    email: "dvorak@moravia-pipe.cz",
    phone: "+420 731 009 215",
    column: "Užší výběr",
    rounds: [
      { label: "Soutěž", price: "1 340 000 Kč" },
      { label: "1. kolo", price: "1 298 000 Kč" },
    ],
    selectedRound: 1,
  },
  {
    company: "Aqua Line s.r.o.",
    person: "Martin Holý",
    email: "holy@aqualine.cz",
    phone: "+420 608 441 773",
    column: "Odesláno",
    rounds: [{ label: "Soutěž", price: "—" }],
    selectedRound: 0,
  },
  {
    company: "Hydro Stav s.r.o.",
    person: "Eva Králová",
    email: "eva@hydrostav.cz",
    phone: "+420 724 330 118",
    column: "Cenová nabídka",
    rounds: [{ label: "Soutěž", price: "1 365 000 Kč" }],
    selectedRound: 0,
  },
] as const;

export const DEMO_CONTRACTS = [
  {
    title: "SOD ZTI — Instal Pro s.r.o.",
    vendor: "Instal Pro s.r.o.",
    number: "SOD-2026-014",
    status: "Aktivní",
    amount: "1 190 000 Kč",
    billed: 18,
    active: true,
  },
  {
    title: "SOD Elektro — Elmont Brno s.r.o.",
    vendor: "Elmont Brno s.r.o.",
    number: "SOD-2026-009",
    status: "Aktivní",
    amount: "860 000 Kč",
    billed: 42,
    active: false,
  },
  {
    title: "SOD Omítky — Fasády Haná s.r.o.",
    vendor: "Fasády Haná s.r.o.",
    number: "SOD-2026-011",
    status: "Rozpracováno",
    amount: "540 000 Kč",
    billed: 0,
    active: false,
  },
] as const;

export const DEMO_CONTRACT = DEMO_CONTRACTS[0];

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
