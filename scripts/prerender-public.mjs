#!/usr/bin/env node
/**
 * Vytvoří statickou HTML variantu pro každou veřejnou routu s vlastními
 * meta tagy (title, description, canonical, OG, Twitter). Vercel servíruje
 * existující statický soubor přednostně před SPA rewrite pravidlem, takže
 * crawlery bez JS uvidí správný meta obsah pro danou stránku.
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
const DEFAULT_IMAGE = `${SITE_URL}/screenshots/kanban.png`;

const ROUTES = [
  {
    path: "/terms",
    title: "Obchodní podmínky | Tender Flow",
    description:
      "Obchodní podmínky používání platformy Tender Flow pro řízení stavebních tendrů a subdodavatelů.",
    type: "article",
    noindex: false,
  },
  {
    path: "/privacy",
    title: "Ochrana osobních údajů | Tender Flow",
    description:
      "Zásady ochrany osobních údajů Tender Flow — jak zpracováváme a chráníme vaše data v souladu s GDPR.",
    type: "article",
    noindex: false,
  },
  {
    path: "/cookies",
    title: "Zásady používání cookies | Tender Flow",
    description:
      "Zásady používání cookies a technologií pro uložení dat v prohlížeči v rámci platformy Tender Flow.",
    type: "article",
    noindex: false,
  },
  {
    path: "/dpa",
    title: "Zpracovatelská doložka (DPA) | Tender Flow",
    description:
      "Zpracovatelská smlouva (Data Processing Agreement) pro zákazníky Tender Flow. GDPR compliance.",
    type: "article",
    noindex: false,
  },
  {
    path: "/imprint",
    title: "Provozovatel a kontaktní údaje | Tender Flow",
    description:
      "Provozovatel platformy Tender Flow, kontaktní údaje a informace o společnosti.",
    type: "article",
    noindex: false,
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

const injectNoscriptSummary = (html, route) => {
  const summary = `<div class="seo-fallback"><h1>${escapeHtml(route.title)}</h1><p>${escapeHtml(route.description)}</p><p><a href="/">Zpět na hlavní stránku Tender Flow</a></p></div>`;
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
    html = injectNoscriptSummary(html, route);

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
