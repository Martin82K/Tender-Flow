export const SITE_URL = "https://tenderflow.cz";
export const SITE_NAME = "Tender Flow";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/screenshots/kanban.png`;

export type SeoMeta = {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  noindex?: boolean;
};

export const DEFAULT_SEO: SeoMeta = {
  title:
    "Tender Flow — CRM pro stavební tendry, subdodavatele a AI analýzu smluv",
  description:
    "Tender Flow je česká CRM platforma pro řízení stavebních tendrů: pipeline nabídek, správa subdodavatelů, AI čtení smluv a objednávek, dokumentový hub a harmonogram. Web i desktop aplikace. 14 dní zdarma.",
  canonical: `${SITE_URL}/`,
  image: DEFAULT_OG_IMAGE,
};

export const ROUTE_SEO: Record<string, SeoMeta> = {
  "/": DEFAULT_SEO,
  "/login": {
    title: "Přihlášení | Tender Flow",
    description:
      "Přihlaste se do Tender Flow — CRM platformy pro řízení stavebních tendrů, subdodavatelů a projektové dokumentace.",
    canonical: `${SITE_URL}/login`,
    noindex: true,
  },
  "/register": {
    title: "Registrace — 14 dní zdarma | Tender Flow",
    description:
      "Vytvořte si účet v Tender Flow a vyzkoušejte 14 dní zdarma bez kreditní karty. CRM pro stavební tendry, subdodavatele a AI analýzu smluv.",
    canonical: `${SITE_URL}/register`,
    noindex: true,
  },
  "/forgot-password": {
    title: "Obnova hesla | Tender Flow",
    description:
      "Zapomněli jste heslo? Obnovte si přístup do Tender Flow — CRM platformy pro řízení stavebních tendrů.",
    canonical: `${SITE_URL}/forgot-password`,
    noindex: true,
  },
  "/reset-password": {
    title: "Nastavení nového hesla | Tender Flow",
    description:
      "Nastavte si nové heslo do svého účtu Tender Flow a pokračujte v řízení stavebních tendrů a subdodavatelů.",
    canonical: `${SITE_URL}/reset-password`,
    noindex: true,
  },
  "/terms": {
    title: "Obchodní podmínky | Tender Flow",
    description:
      "Obchodní podmínky používání platformy Tender Flow pro řízení stavebních tendrů a subdodavatelů.",
    canonical: `${SITE_URL}/terms`,
  },
  "/privacy": {
    title: "Ochrana osobních údajů | Tender Flow",
    description:
      "Zásady ochrany osobních údajů Tender Flow — jak zpracováváme a chráníme vaše data v souladu s GDPR.",
    canonical: `${SITE_URL}/privacy`,
  },
  "/cookies": {
    title: "Zásady používání cookies | Tender Flow",
    description:
      "Zásady používání cookies a technologií pro uložení dat v prohlížeči v rámci platformy Tender Flow.",
    canonical: `${SITE_URL}/cookies`,
  },
  "/dpa": {
    title: "Zpracovatelská doložka (DPA) | Tender Flow",
    description:
      "Zpracovatelská smlouva (Data Processing Agreement) pro zákazníky Tender Flow. GDPR compliance.",
    canonical: `${SITE_URL}/dpa`,
  },
  "/imprint": {
    title: "Provozovatel a kontaktní údaje | Tender Flow",
    description:
      "Provozovatel platformy Tender Flow, kontaktní údaje a informace o společnosti.",
    canonical: `${SITE_URL}/imprint`,
  },
};

export const resolveSeo = (pathname: string): SeoMeta => {
  if (ROUTE_SEO[pathname]) return ROUTE_SEO[pathname];

  // /app/* — aplikace za autentizací, nechceme indexovat
  if (pathname.startsWith("/app")) {
    return {
      title: "Tender Flow",
      description: DEFAULT_SEO.description,
      canonical: `${SITE_URL}${pathname}`,
      noindex: true,
    };
  }

  // /s/* — zkrácené odkazy, neindexovat
  if (pathname.startsWith("/s/")) {
    return {
      title: "Přesměrování | Tender Flow",
      description: "Přesměrování na cílový odkaz.",
      noindex: true,
    };
  }

  return DEFAULT_SEO;
};
