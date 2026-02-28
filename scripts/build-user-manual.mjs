import fs from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import { Slugger, extractManualKbEntries } from "./user-manual-kb.mjs";

const main = async () => {
  const mdPath = path.resolve("public/user-manual/index.md");
  const outPath = path.resolve("public/user-manual/index.html");
  const kbOutPath = path.resolve("public/user-manual/index.kb.json");

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
        --bg: #090e17;
        --sidebar-bg: rgba(13, 18, 28, 0.7);
        --panel: rgba(255, 255, 255, 0.04);
        --panel-hover: rgba(255, 255, 255, 0.08);
        --text: rgba(255, 255, 255, 0.95);
        --muted: rgba(255, 255, 255, 0.65);
        --border: rgba(255, 255, 255, 0.08);
        --accent: #2dd4bf;
        --accent-warm: #f59e0b;
        --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.2);
        --shadow-lg: 0 20px 40px rgba(0, 0, 0, 0.5);
        --radius: 20px;
        --radius-sm: 12px;
        --max: 1120px;
        --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
          "Liberation Mono", "Courier New", monospace;
        --sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
          Helvetica, Arial;
      }

      * {
        box-sizing: border-box;
      }
      html, body {
        height: 100%;
        scroll-behavior: smooth;
      }
      body {
        margin: 0;
        font-family: var(--sans);
        color: var(--text);
        background-color: var(--bg);
        background-image: 
          radial-gradient(1200px 800px at 15% 5%, rgba(45, 212, 191, 0.15), transparent 50%),
          radial-gradient(1000px 700px at 85% 95%, rgba(96, 165, 250, 0.12), transparent 50%),
          radial-gradient(800px 600px at 50% 50%, rgba(245, 158, 11, 0.05), transparent 60%);
        background-attachment: fixed;
        overflow-x: hidden;
      }

      ::selection {
        background: rgba(45, 212, 191, 0.3);
        color: #fff;
      }

      a {
        color: var(--accent);
        text-decoration: none;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      a:hover {
        color: #5eead4;
        text-shadow: 0 0 12px rgba(94, 234, 212, 0.4);
      }

      .app {
        display: grid;
        grid-template-columns: 340px 1fr;
        min-height: 100%;
      }

      .sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        padding: 24px;
        border-right: 1px solid var(--border);
        background: var(--sidebar-bg);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        overflow-y: auto;
        overflow-x: hidden;
        z-index: 10;
        box-shadow: 4px 0 24px rgba(0, 0, 0, 0.2);
        scrollbar-width: thin;
      }
      .sidebar::-webkit-scrollbar {
        width: 6px;
      }
      .sidebar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 6px;
      }

      .brand {
        display: flex;
        gap: 16px;
        align-items: center;
        padding: 18px 20px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: var(--radius);
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01));
        box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1), var(--shadow-sm);
        margin-bottom: 24px;
        position: relative;
        overflow: hidden;
      }
      .brand::before {
        content: "";
        position: absolute;
        top: 0; left: -100%;
        width: 50%; height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
        transform: skewX(-20deg);
        animation: shine 6s infinite;
      }
      @keyframes shine {
        0% { left: -100%; }
        20% { left: 200%; }
        100% { left: 200%; }
      }

      .brand .logo-img {
        width: 52px;
        height: 52px;
        border-radius: 14px;
        object-fit: contain;
        padding: 8px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.5);
      }
      .brand h1 {
        font-size: 18px;
        margin: 0;
        font-weight: 800;
        letter-spacing: 0.5px;
        background: linear-gradient(to right, #fff, #a5b4fc);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .brand p {
        margin: 4px 0 0 0;
        color: var(--muted);
        font-size: 13px;
        font-weight: 500;
      }

      .nav {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .section {
        border: 1px solid transparent;
        border-radius: 16px;
        background: transparent;
        padding: 4px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .section:hover {
        border-color: rgba(45, 212, 191, 0.2);
        background: rgba(45, 212, 191, 0.03);
        box-shadow: inset 0 0 20px rgba(45, 212, 191, 0.05);
      }
      .sectionTitle {
        display: block;
        padding: 12px 14px;
        border-radius: var(--radius-sm);
        font-weight: 700;
        font-size: 14px;
        color: var(--text);
        background: var(--panel);
        border: 1px solid var(--border);
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
      }
      .sectionTitle::after {
        content: '';
        position: absolute;
        left: 0; bottom: 0;
        width: 0; height: 2px;
        background: var(--accent);
        transition: width 0.3s ease;
      }
      .section:hover .sectionTitle {
        background: rgba(45, 212, 191, 0.1);
        border-color: rgba(45, 212, 191, 0.3);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
      .section:hover .sectionTitle::after {
        width: 100%;
      }
      
      .sub {
        margin-top: 6px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 4px 8px 4px 16px;
        border-left: 2px solid rgba(255, 255, 255, 0.05);
        margin-left: 12px;
      }
      .sub a {
        display: block;
        padding: 8px 12px;
        border-radius: 10px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s ease;
        position: relative;
      }
      .sub a::before {
        content: '';
        position: absolute;
        left: -18px; top: 50%;
        width: 12px; height: 2px;
        background: rgba(255, 255, 255, 0.1);
        transition: all 0.2s ease;
      }
      .sub a:hover {
        color: var(--text);
        background: var(--panel-hover);
        transform: translateX(4px);
      }
      .sub a:hover::before {
        background: var(--accent);
        width: 16px;
      }

      .content {
        padding: 40px 60px;
        display: flex;
        justify-content: center;
      }
      .wrap {
        width: 100%;
        max-width: var(--max);
        animation: fadeUp 0.6s ease-out forwards;
      }
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }

      article {
        border-radius: 24px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(13, 18, 28, 0.6);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.05), var(--shadow-lg);
        padding: 48px;
        position: relative;
        overflow: hidden;
      }
      article::before {
        content: "";
        position: absolute;
        top: 0; left: 0; right: 0; height: 1px;
        background: linear-gradient(90deg, transparent, rgba(45, 212, 191, 0.5), transparent);
        opacity: 0.5;
      }

      h1 {
        font-size: 46px;
        margin: 0 0 16px 0;
        font-weight: 800;
        letter-spacing: -1px;
        background: linear-gradient(135deg, #ffffff 0%, #2dd4bf 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        line-height: 1.1;
      }
      h2 {
        font-size: 28px;
        margin: 48px 0 20px 0;
        font-weight: 800;
        color: #fff;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        position: relative;
      }
      h2::after {
        content: '';
        position: absolute;
        bottom: -1px; left: 0;
        width: 60px; height: 2px;
        background: var(--accent);
        box-shadow: 0 0 10px rgba(45, 212, 191, 0.5);
      }
      h3 {
        font-size: 20px;
        margin: 32px 0 12px 0;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.95);
      }
      h4 {
        font-size: 16px;
        margin: 24px 0 8px 0;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.85);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      p, li {
        line-height: 1.8;
        color: rgba(255, 255, 255, 0.8);
        font-size: 16px;
      }
      li {
        margin-bottom: 10px;
      }
      ul, ol {
        padding-left: 24px;
      }
      li::marker {
        color: var(--accent);
      }
      code {
        font-family: var(--mono);
        font-size: 0.85em;
        padding: 0.25em 0.5em;
        border-radius: 6px;
        background: rgba(45, 212, 191, 0.1);
        border: 1px solid rgba(45, 212, 191, 0.2);
        color: #5eead4;
        white-space: nowrap;
      }
      pre {
        background: #05080f;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 24px;
        overflow-x: auto;
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.5);
        margin: 24px 0;
      }
      pre code {
        display: block;
        padding: 0;
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.85);
        white-space: pre;
        font-size: 14px;
        line-height: 1.6;
      }
      img {
        max-width: 100%;
        height: auto;
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(0, 0, 0, 0.2);
        margin: 24px 0;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
        transition: transform 0.3s ease, box-shadow 0.3s ease;
      }
      img:hover {
        transform: translateY(-4px);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
      }

      .manualLogoWrap {
        margin: 32px 0 28px 0;
        display: flex;
        justify-content: center;
      }
      .manualLogo {
        width: min(320px, 70vw);
        height: auto;
        border-radius: 24px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%);
        padding: 24px;
        box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.2), 0 20px 50px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(8px);
      }
      hr {
        border: none;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent);
        margin: 48px 0;
      }

      .generated {
        margin-top: 32px;
        color: rgba(255, 255, 255, 0.4);
        font-size: 13px;
        text-align: center;
      }

      table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        margin: 24px 0;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        overflow: hidden;
      }
      th, td {
        padding: 16px 20px;
        text-align: left;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      th {
        background: rgba(45, 212, 191, 0.08);
        font-weight: 700;
        color: rgba(255, 255, 255, 0.95);
        text-transform: uppercase;
        font-size: 13px;
        letter-spacing: 0.5px;
      }
      tr:last-child td {
        border-bottom: none;
      }
      tr:nth-child(even) td {
        background: rgba(255, 255, 255, 0.02);
      }
      tr:hover td {
        background: rgba(255, 255, 255, 0.06);
      }

      .version-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: linear-gradient(to right, rgba(45, 212, 191, 0.15), rgba(45, 212, 191, 0.05));
        border: 1px solid rgba(45, 212, 191, 0.4);
        padding: 6px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        color: #5eead4;
        margin-right: 12px;
        box-shadow: 0 4px 12px rgba(45, 212, 191, 0.1);
      }

      .tip-box {
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%);
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-left: 4px solid var(--accent-warm);
        border-radius: 16px;
        padding: 24px;
        margin: 32px 0;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        position: relative;
        overflow: hidden;
      }
      .tip-box::after {
        content: '💡';
        position: absolute;
        top: -10px; right: -10px;
        font-size: 100px;
        opacity: 0.04;
      }
      .tip-box strong {
        color: #fbbf24;
        font-weight: 700;
        font-size: 1.1em;
        display: block;
        margin-bottom: 8px;
        letter-spacing: 0.3px;
      }
      .tip-box p {
        margin: 0;
        color: rgba(255, 255, 255, 0.9);
      }

      @media (max-width: 1024px) {
        .app {
          grid-template-columns: 280px 1fr;
        }
        .content {
          padding: 32px 24px;
        }
        article {
          padding: 32px;
        }
      }

      @media (max-width: 768px) {
        .app {
          grid-template-columns: 1fr;
        }
        .sidebar {
          position: relative;
          height: auto;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
          box-shadow: none;
          border-right: none;
          border-bottom: 1px solid var(--border);
        }
        h1 {
          font-size: 36px;
        }
        h2 {
          font-size: 24px;
        }
        article {
          padding: 24px;
          border-radius: 16px;
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
  const kbEntries = extractManualKbEntries(markdown);
  await fs.writeFile(
    kbOutPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "/public/user-manual/index.md",
        entries: kbEntries,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`Generated: ${path.relative(process.cwd(), outPath)}`);
  console.log(`Generated: ${path.relative(process.cwd(), kbOutPath)}`);
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
