#!/usr/bin/env node
/**
 * Vytvoří statickou HTML variantu pro každou veřejnou routu s vlastními
 * meta tagy (title, description, canonical, OG, Twitter) a per-page
 * JSON-LD (BreadcrumbList + WebPage). Vercel servíruje existující
 * statický soubor přednostně před SPA rewrite pravidlem, takže crawlery
 * bez JS uvidí správný meta obsah pro danou stránku.
 *
 * Závislosti: pouze Node stdlib. Žádný headless browser.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "..", "dist");
const SITE_URL = "https://tenderflow.cz";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

const ROUTES = [
  {
    path: "/terms",
    title: "Obchodní podmínky | Tender Flow",
    description:
      "Obchodní podmínky používání platformy Tender Flow pro přípravu a vedení staveb, stavební tendry a subdodavatele.",
    breadcrumbName: "Obchodní podmínky",
    type: "article",
    noindex: false,
    summary:
      "Tato stránka obsahuje aktuální obchodní podmínky používání platformy Tender Flow pro přípravu a vedení staveb, správu stavebních tendrů, subdodavatelů a souvisejících modulů. Definuje práva a povinnosti zákazníka i provozovatele, podmínky předplatného Starter / Pro / Enterprise, postup při ukončení smlouvy, omezení odpovědnosti a způsob řešení sporů.",
  },
  {
    path: "/privacy",
    title: "Ochrana osobních údajů | Tender Flow",
    description:
      "Zásady ochrany osobních údajů Tender Flow — jak zpracováváme a chráníme vaše data v souladu s GDPR.",
    breadcrumbName: "Ochrana osobních údajů",
    type: "article",
    noindex: false,
    summary:
      "Zásady ochrany osobních údajů popisují, jaké informace Tender Flow zpracovává (kontaktní údaje, fakturační data, projektové soubory), na jakém právním základě, jak dlouho je uchovává a jaká máte práva podle GDPR (přístup, oprava, výmaz, přenositelnost, námitka). Data jsou uložena v EU (Frankfurt), chráněna šifrováním a Row Level Security na úrovni databáze.",
  },
  {
    path: "/cookies",
    title: "Zásady používání cookies | Tender Flow",
    description:
      "Zásady používání cookies a technologií pro uložení dat v prohlížeči v rámci platformy Tender Flow.",
    breadcrumbName: "Zásady cookies",
    type: "article",
    noindex: false,
    summary:
      "Tender Flow používá pouze technicky nezbytné cookies pro fungování přihlášení a udržení relace. Statistické a marketingové cookies vyžadují výslovný souhlas v cookie banneru. Tato stránka popisuje konkrétní cookies, jejich účel, dobu uložení a způsob, jak souhlas spravovat či odvolat.",
  },
  {
    path: "/dpa",
    title: "Zpracovatelská doložka (DPA) | Tender Flow",
    description:
      "Zpracovatelská smlouva (Data Processing Agreement) pro zákazníky Tender Flow. GDPR compliance.",
    breadcrumbName: "Zpracovatelská doložka (DPA)",
    type: "article",
    noindex: false,
    summary:
      "Zpracovatelská smlouva (DPA) upravuje vztah mezi zákazníkem (správce osobních údajů) a Tender Flow (zpracovatel) v souladu s článkem 28 GDPR. Vymezuje předmět a délku zpracování, kategorie subjektů údajů, technická a organizační opatření, postupy při bezpečnostním incidentu a podmínky využití subdodavatelů.",
  },
  {
    path: "/imprint",
    title: "Provozovatel a kontaktní údaje | Tender Flow",
    description:
      "Provozovatel platformy Tender Flow, kontaktní údaje a informace o společnosti.",
    breadcrumbName: "Provozovatel",
    type: "article",
    noindex: false,
    summary:
      "Provozovatelem platformy Tender Flow je společnost TenderFlow s.r.o. Tato stránka obsahuje povinné identifikační údaje, kontaktní e-mail (info@tenderflow.cz) a informace o registraci. Pro obchodní dotazy a podporu nás kontaktujte přímo e-mailem.",
  },
];

const escapeHtml = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const replaceMeta = (html, { title, description, canonical, type, noindex }) => {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeCanon = escapeHtml(canonical);
  const robots = noindex
    ? "noindex, nofollow"
    : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${safeTitle}</title>`)
    .replace(
      /<meta name="description"[^>]*>/,
      `<meta name="description" content="${safeDesc}" />`,
    )
    .replace(
      /<meta name="robots"[^>]*>/,
      `<meta name="robots" content="${robots}" />`,
    )
    .replace(
      /<link rel="canonical"[^>]*>/,
      `<link rel="canonical" href="${safeCanon}" />`,
    )
    .replace(
      /<meta property="og:url"[^>]*>/,
      `<meta property="og:url" content="${safeCanon}" />`,
    )
    .replace(
      /<meta property="og:title"[^>]*>/,
      `<meta property="og:title" content="${safeTitle}" />`,
    )
    .replace(
      /<meta property="og:description"[^>]*>/,
      `<meta property="og:description" content="${safeDesc}" />`,
    )
    .replace(
      /<meta property="og:type"[^>]*>/,
      `<meta property="og:type" content="${type}" />`,
    )
    .replace(
      /<meta name="twitter:title"[^>]*>/,
      `<meta name="twitter:title" content="${safeTitle}" />`,
    )
    .replace(
      /<meta name="twitter:description"[^>]*>/,
      `<meta name="twitter:description" content="${safeDesc}" />`,
    );
};

/**
 * Per-page JSON-LD: BreadcrumbList + WebPage. Injektuje se před uzavírací
 * </head> tag, takže existující JSON-LD bloky pro Organization, WebSite,
 * SoftwareApplication, FAQPage a HowTo zůstávají zachované.
 */
const injectPerPageJsonLd = (html, route, canonical) => {
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Tender Flow",
        item: `${SITE_URL}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: route.breadcrumbName,
        item: canonical,
      },
    ],
  };

  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${canonical}#webpage`,
    url: canonical,
    name: route.title,
    description: route.description,
    inLanguage: "cs-CZ",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    breadcrumb: { "@id": `${canonical}#breadcrumb` },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: DEFAULT_IMAGE,
    },
  };

  // Přidáme @id na breadcrumb tak, aby ho WebPage mohl referencovat.
  breadcrumb["@id"] = `${canonical}#breadcrumb`;

  const block = `
  <!-- JSON-LD: per-page (vygenerováno prerender skriptem) -->
  <script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
  <script type="application/ld+json">${JSON.stringify(webPage)}</script>
`;

  return html.replace("</head>", `${block}</head>`);
};

const injectNoscriptSummary = (html, route, canonical) => {
  const safeTitle = escapeHtml(route.title);
  const safeDesc = escapeHtml(route.description);
  const safeSummary = escapeHtml(route.summary || route.description);
  const safeName = escapeHtml(route.breadcrumbName);

  const summary = `<div class="seo-fallback">
      <nav aria-label="breadcrumb"><a href="/">Tender Flow</a> &rsaquo; <span>${safeName}</span></nav>
      <h1>${safeTitle}</h1>
      <p>${safeDesc}</p>
      <p>${safeSummary}</p>
      <p><strong>Kontakt:</strong> <a href="mailto:info@tenderflow.cz">info@tenderflow.cz</a></p>
      <p>
        <a href="/">Hlavní stránka</a> ·
        <a href="/terms">Obchodní podmínky</a> ·
        <a href="/privacy">Ochrana osobních údajů</a> ·
        <a href="/cookies">Cookies</a> ·
        <a href="/dpa">DPA</a> ·
        <a href="/imprint">Provozovatel</a>
      </p>
    </div>`;
  return html.replace(
    /<noscript>[\s\S]*?<\/noscript>/,
    `<noscript>${summary}</noscript>`,
  );
};

const run = async () => {
  if (process.env.ELECTRON_BUILD === "true") {
    console.log("[prerender] Desktop build — přeskakuji prerender veřejných routů.");
    return;
  }
  const indexPath = path.join(distDir, "index.html");
  let baseHtml;
  try {
    baseHtml = await fs.readFile(indexPath, "utf8");
  } catch {
    console.error(
      `[prerender] dist/index.html nenalezen — spusť nejdřív \`npm run build\`.`,
    );
    process.exit(1);
  }

  const written = [];
  for (const route of ROUTES) {
    const canonical = `${SITE_URL}${route.path}`;
    let html = replaceMeta(baseHtml, {
      title: route.title,
      description: route.description,
      canonical,
      type: route.type,
      noindex: route.noindex,
    });
    html = injectPerPageJsonLd(html, route, canonical);
    html = injectNoscriptSummary(html, route, canonical);

    const outDir = path.join(distDir, route.path.slice(1));
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, "index.html"), html, "utf8");
    written.push(`${route.path}/index.html`);
  }

  console.log(
    `[prerender] Vygenerováno ${written.length} statických HTML variant:`,
  );
  written.forEach((p) => console.log(`  dist${p}`));
};

run().catch((err) => {
  console.error("[prerender] selhalo:", err);
  process.exit(1);
});
