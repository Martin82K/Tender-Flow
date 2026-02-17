import fs from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

const slugify = (raw) => {
  const text = String(raw)
    .replace(/<[^>]*>/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const slug = text
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "section";
};

class Slugger {
  #counts = new Map();
  slug(value) {
    const base = slugify(value);
    const count = this.#counts.get(base) || 0;
    this.#counts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  }
}

const main = async () => {
  const mdPath = path.resolve("public/user-manual/index.md");
  const outPath = path.resolve("public/user-manual/index.html");

  const markdown = await fs.readFile(mdPath, "utf8");

  const headings = [];
  const slugger = new Slugger();
  const renderer = new marked.Renderer();

  renderer.heading = (text, level, raw) => {
    const id = slugger.slug(raw || text);
    if (level === 2 || level === 3) headings.push({ level, id, text });
    return `<h${level} id="${id}">${text}</h${level}>\n`;
  };

  marked.setOptions({
    renderer,
    gfm: true,
    breaks: false,
    headerIds: false,
    mangle: false,
  });

  const contentHtml = marked.parse(markdown);

  const sections = [];
  let current = null;
  for (const h of headings) {
    if (h.level === 2) {
      current = { ...h, children: [] };
      sections.push(current);
    } else if (h.level === 3 && current) {
      current.children.push(h);
    }
  }

  const tocHtml = sections
    .map((s) => {
      const children = s.children?.length
        ? `<div class="sub">${s.children
            .map((c) => `<a href="#${c.id}">${c.text}</a>`)
            .join("")}</div>`
        : "";
      return `<div class="section"><a class="sectionTitle" href="#${s.id}">${s.text}</a>${children}</div>`;
    })
    .join("\n");

const html = `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tender Flow – Uživatelská příručka</title>
    <meta
      name="description"
      content="Uživatelská příručka pro aplikaci Tender Flow – stavby, výběrová řízení, subdodavatelé, dokumenty a nastavení."
    />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
      :root {
        --bg: #0b1220;
        --panel: rgba(255, 255, 255, 0.06);
        --panel-2: rgba(255, 255, 255, 0.08);
        --text: rgba(255, 255, 255, 0.92);
        --muted: rgba(255, 255, 255, 0.66);
        --border: rgba(255, 255, 255, 0.12);
        --accent: #2dd4bf;
        --accent-warm: #f59e0b;
        --shadow: 0 10px 34px rgba(0, 0, 0, 0.38);
        --radius: 18px;
        --max: 1120px;
        --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
          "Liberation Mono", "Courier New", monospace;
        --sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
          Helvetica, Arial;
      }

      * {
        box-sizing: border-box;
      }
      html,
      body {
        height: 100%;
      }
      body {
        margin: 0;
        font-family: var(--sans);
        color: var(--text);
        background: radial-gradient(
            1200px 800px at 20% 10%,
            rgba(45, 212, 191, 0.12),
            transparent 60%
          ),
          radial-gradient(
            900px 600px at 80% 0%,
            rgba(96, 165, 250, 0.12),
            transparent 55%
          ),
          linear-gradient(180deg, #060a12 0%, var(--bg) 30%, #050a13 100%);
      }

      a {
        color: var(--accent);
        text-decoration: none;
        transition: all 0.2s ease;
      }
      a:hover {
        text-decoration: underline;
        color: #5eead4;
      }

      .app {
        display: grid;
        grid-template-columns: 320px 1fr;
        min-height: 100%;
      }

      .sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        padding: 18px;
        border-right: 1px solid var(--border);
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.04),
          rgba(255, 255, 255, 0.02)
        );
        overflow: auto;
      }

      .brand {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 16px 16px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: rgba(0, 0, 0, 0.18);
        box-shadow: var(--shadow);
      }
      .brand .logo-img {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        object-fit: contain;
        padding: 6px;
        background: rgba(255, 255, 255, 0.045);
        border: 1px solid rgba(255, 255, 255, 0.10);
      }
      .brand h1 {
        font-size: 15px;
        margin: 0;
        font-weight: 700;
        letter-spacing: 0.2px;
      }
      .brand p {
        margin: 2px 0 0 0;
        color: var(--muted);
        font-size: 12px;
      }

      .nav {
        margin-top: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .section {
        border: 1px solid var(--border);
        border-radius: 14px;
        background: rgba(0, 0, 0, 0.18);
        padding: 10px 10px;
        transition: all 0.2s ease;
      }
      .section:hover {
        border-color: rgba(45, 212, 191, 0.3);
        background: rgba(0, 0, 0, 0.22);
      }
      .sectionTitle {
        display: block;
        padding: 10px 10px;
        border-radius: 12px;
        font-weight: 700;
        font-size: 13px;
        color: var(--text);
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        transition: all 0.2s ease;
      }
      .section:hover .sectionTitle {
        background: rgba(45, 212, 191, 0.1);
        border-color: rgba(45, 212, 191, 0.2);
      }
      .sub {
        margin-top: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 0 4px 2px 4px;
      }
      .sub a {
        display: block;
        padding: 8px 10px;
        border-radius: 12px;
        color: var(--muted);
        border: 1px solid transparent;
        font-size: 12px;
        transition: all 0.2s ease;
      }
      .sub a:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.08);
        text-decoration: none;
        color: var(--text);
      }

      .content {
        padding: 32px 40px;
      }
      .wrap {
        max-width: var(--max);
        margin: 0 auto;
      }

      article {
        border-radius: 22px;
        border: 1px solid var(--border);
        background: rgba(0, 0, 0, 0.16);
        box-shadow: var(--shadow);
        padding: 32px 36px;
      }

      h1 {
        font-size: 38px;
        margin: 0 0 10px 0;
        font-weight: 800;
        background: linear-gradient(135deg, #fff 0%, rgba(45, 212, 191, 0.8) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      h2 {
        font-size: 24px;
        margin: 36px 0 14px 0;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.95);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 10px;
      }
      h3 {
        font-size: 17px;
        margin: 22px 0 10px 0;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.88);
      }
      h4 {
        font-size: 15px;
        margin: 16px 0 8px 0;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.82);
      }
      p,
      li {
        line-height: 1.7;
        color: rgba(255, 255, 255, 0.84);
        font-size: 15px;
      }
      li {
        margin-bottom: 6px;
      }
      code {
        font-family: var(--mono);
        font-size: 0.9em;
        padding: 0.2em 0.44em;
        border-radius: 8px;
        background: rgba(45, 212, 191, 0.15);
        border: 1px solid rgba(45, 212, 191, 0.25);
        color: #5eead4;
      }
      pre {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 12px;
        border: 1px solid var(--border);
        padding: 16px;
        overflow-x: auto;
      }
      pre code {
        display: block;
        padding: 0;
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.9);
      }
      img {
        max-width: 100%;
        height: auto;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.04);
        margin: 12px 0;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      }

      .manualLogoWrap {
        margin: 24px 0 20px 0;
        display: flex;
        justify-content: center;
      }
      .manualLogo {
        width: min(280px, 60vw);
        height: auto;
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.10);
        background: rgba(255, 255, 255, 0.02);
        padding: 16px 20px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.40);
      }
      hr {
        border: none;
        border-top: 1px solid rgba(255, 255, 255, 0.12);
        margin: 28px 0;
      }

      .generated {
        margin-top: 24px;
        color: rgba(255, 255, 255, 0.45);
        font-size: 12px;
        text-align: center;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin: 16px 0;
        font-size: 14px;
      }
      th, td {
        padding: 12px 16px;
        text-align: left;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      th {
        background: rgba(45, 212, 191, 0.1);
        font-weight: 600;
        color: rgba(255, 255, 255, 0.9);
      }
      tr:hover td {
        background: rgba(255, 255, 255, 0.03);
      }

      .version-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(45, 212, 191, 0.15);
        border: 1px solid rgba(45, 212, 191, 0.3);
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 13px;
        color: #5eead4;
        margin-right: 8px;
      }

      .tip-box {
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%);
        border: 1px solid rgba(245, 158, 11, 0.25);
        border-radius: 12px;
        padding: 16px 20px;
        margin: 16px 0;
      }
      .tip-box strong {
        color: var(--accent-warm);
      }

      @media (max-width: 980px) {
        .app {
          grid-template-columns: 1fr;
        }
        .sidebar {
          position: relative;
          height: auto;
        }
        .content {
          padding: 20px;
        }
        article {
          padding: 20px;
        }
      }
    </style>
  </head>
  <body>
    <div class="app">
      <aside class="sidebar">
        <div class="brand">
          <img
            class="logo-img"
            src="./assets/logo.png"
            alt="Tender Flow Logo"
            loading="eager"
            decoding="async"
          />
          <div>
            <h1>Tender Flow</h1>
            <p>Uživatelská příručka</p>
          </div>
        </div>
        <nav class="nav" aria-label="Obsah příručky">${tocHtml}</nav>
      </aside>
      <main class="content">
        <div class="wrap">
          <article class="markdown">${contentHtml}</article>
          <div class="generated">
            Generováno z <code>/public/user-manual/index.md</code>
          </div>
        </div>
      </main>
    </div>
    <script>
      document.addEventListener("click", (e) => {
        const a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
        if (!a) return;
        const id = a.getAttribute("href").slice(1);
        const el = document.getElementById(id);
        if (!el) return;
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", "#" + id);
      });
    </script>
  </body>
</html>
`;

  await fs.writeFile(outPath, html, "utf8");
  console.log(`Generated: ${path.relative(process.cwd(), outPath)}`);
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
