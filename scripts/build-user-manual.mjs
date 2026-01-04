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
    <style>
      :root {
        --bg: #0b1220;
        --panel: rgba(255, 255, 255, 0.06);
        --panel-2: rgba(255, 255, 255, 0.08);
        --text: rgba(255, 255, 255, 0.92);
        --muted: rgba(255, 255, 255, 0.66);
        --border: rgba(255, 255, 255, 0.12);
        --accent: #2dd4bf;
        --shadow: 0 10px 34px rgba(0, 0, 0, 0.38);
        --radius: 18px;
        --max: 1120px;
        --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
          "Liberation Mono", "Courier New", monospace;
        --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
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
      }
      a:hover {
        text-decoration: underline;
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
        padding: 12px 12px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: rgba(0, 0, 0, 0.18);
        box-shadow: var(--shadow);
      }
      .brand .logo-img {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        object-fit: contain;
        padding: 5px;
        background: rgba(255, 255, 255, 0.045);
        border: 1px solid rgba(255, 255, 255, 0.10);
      }
      .brand h1 {
        font-size: 14px;
        margin: 0;
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
      }
      .sectionTitle {
        display: block;
        padding: 10px 10px;
        border-radius: 12px;
        font-weight: 800;
        color: var(--text);
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
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
      }
      .sub a:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.08);
        text-decoration: none;
        color: var(--text);
      }

      .content {
        padding: 24px;
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
        padding: 26px 26px;
      }

      h1 {
        font-size: 34px;
        margin: 0 0 10px 0;
      }
      h2 {
        font-size: 22px;
        margin: 28px 0 10px 0;
      }
      h3 {
        font-size: 16px;
        margin: 18px 0 8px 0;
        color: rgba(255, 255, 255, 0.88);
      }
      p,
      li {
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.84);
      }
      code {
        font-family: var(--mono);
        font-size: 0.92em;
        padding: 0.16em 0.36em;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
      }
      pre code {
        display: block;
        padding: 14px 14px;
        overflow: auto;
      }
      img {
        max-width: 100%;
        height: auto;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.04);
      }

      .manualLogoWrap {
        margin: 16px 0 10px 0;
        display: flex;
        justify-content: center;
      }
      .manualLogo {
        width: min(220px, 55vw);
        height: auto;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.10);
        background: rgba(255, 255, 255, 0.02);
        padding: 10px 12px;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.30);
      }
      hr {
        border: none;
        border-top: 1px solid rgba(255, 255, 255, 0.12);
        margin: 22px 0;
      }

      .generated {
        margin-top: 10px;
        color: rgba(255, 255, 255, 0.55);
        font-size: 12px;
        text-align: center;
      }

      @media (max-width: 980px) {
        .app {
          grid-template-columns: 1fr;
        }
        .sidebar {
          position: relative;
          height: auto;
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
