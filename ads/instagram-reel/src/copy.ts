/**
 * On-screen Czech copy for the 15s Instagram Reel.
 * CTA is the marketing-confirmed landing wording: Czech www host only.
 * Demo rows are synthetic and only echo the public app screenshots' layout.
 */
export const CTA = {
  primary: "Domluvit ukázku",
  url: "tenderflow.cz",
  href: "https://www.tenderflow.cz",
} as const;

export const TAGLINE = "Jedna cesta v jednom nástroji.";

export const PRODUCT_NAME = "Tender Flow";
export const PRODUCT_SUBLINE = "Tender Management System";
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
  status: "Detail stavby",
  category: "ZTI a vytápění",
  crumb: "Průběh výběrového řízení",
} as const;

export const DEMO_CATEGORIES = [
  {
    title: "Elektroinstalace",
    status: "Poptávání",
    tone: "open",
    asked: "4",
    offers: "0",
    description: "Silnoproud, slaboproud a osvětlení učeben.",
    deadline: "12. 5. 2026",
    realization: "1. 8. 2026 – 30. 9. 2026",
    priceLabel: "Cena SOD (Investor)",
    price: "1 400 000 Kč",
  },
  {
    title: "Hrubá stavba",
    status: "Vyjednávání",
    tone: "negotiating",
    asked: "4",
    offers: "2",
    description: "Zdivo, stropy a svislé konstrukce pavilonu.",
    deadline: "4. 5. 2026",
    realization: "15. 7. 2026 – 20. 9. 2026",
    priceLabel: "Cena SOD (Investor)",
    price: "4 800 000 Kč",
  },
  {
    title: "Střecha a klempíř",
    status: "Poptávání",
    tone: "open",
    asked: "3",
    offers: "0",
    description: "Krytina, oplechování a svody na pavilonu A.",
    deadline: "20. 5. 2026",
    realization: "10. 8. 2026 – 15. 9. 2026",
    priceLabel: "Cena SOD (Investor)",
    price: "2 100 000 Kč",
  },
  {
    title: "Zemní práce",
    status: "V Realizaci",
    tone: "closed",
    asked: "4",
    offers: "2",
    description: "Výkopy, základové desky a hydroizolace.",
    deadline: "18. 3. 2026",
    realization: "1. 4. 2026 – 15. 5. 2026",
    priceLabel: "Vítězná cena",
    price: "2 450 000 Kč",
    contracts: "1/1",
  },
  {
    title: "ZTI a vytápění",
    status: "Poptávání",
    tone: "open",
    asked: "6",
    offers: "3",
    description: "Vodovod, kanalizace a topení v objektu školy.",
    deadline: "24. 4. 2026",
    realization: "8. 8. 2026 – 12. 10. 2026",
    priceLabel: "Cena SOD (Investor)",
    price: "1 190 000 Kč",
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

export const DEMO_OVERVIEW = {
  budget: "18 950 000 Kč",
  planned: "15 000 000 Kč",
  contracted: "2 450 000 Kč",
  progress: "1/5",
} as const;

export const DEMO_TABLE = [
  { status: "Probíhá", tone: "open", title: "Elektroinstalace", sod: "1 400 000 Kč", bids: "0 / 0" },
  { status: "Jednání", tone: "negotiating", title: "Hrubá stavba", sod: "4 800 000 Kč", bids: "2 / 2" },
  { status: "Zasmluvněno", tone: "closed", title: "Zemní práce", sod: "2 800 000 Kč", bids: "2 / 2", winner: "Instal Pro" },
] as const;

export const DEMO_CONTRACTS = [
  {
    title: "SOD Zemní práce — Instal Pro s.r.o.",
    vendor: "Instal Pro s.r.o.",
    number: "SOD-2026-014",
    status: "Aktivní",
    amount: "2 450 000 Kč",
    billed: 18,
    active: true,
  },
  {
    title: "SOD Elektro — Elmont Brno s.r.o.",
    vendor: "Elmont Brno s.r.o.",
    number: "SOD-2026-009",
    status: "Rozpracováno",
    amount: "1 400 000 Kč",
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
