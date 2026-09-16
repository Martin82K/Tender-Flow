import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Marked } from 'marked';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { Slugger, extractManualKbEntries } from './user-manual-kb.mjs';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function buildManualHtml(markdown, { version, reviewedAt, aliases = {}, imageSizes = {} }) {
  const reviewDate = reviewedAt
    ? new Intl.DateTimeFormat('cs-CZ', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(`${reviewedAt}T00:00:00Z`))
    : 'Datum neuvedeno';
  const headings = [];
  const slugger = new Slugger();
  const parser = new Marked({ gfm: true });
  parser.use({ renderer: {
    heading(text, level, raw) {
      const id = slugger.slug(raw || text);
      headings.push({ id, level, text });
      return `<h${level} id="${id}">${text}</h${level}>\n`;
    },
    image(href, title, text) {
      if (!/^\.\/assets\/[a-zA-Z0-9._-]+\.(png|webp|svg)$/.test(href)) throw new Error(`Invalid manual image: ${href}`);
      const { width = 1200, height = 720 } = imageSizes[href] || {};
      return `<figure><a href="${escape(href)}" data-screenshot aria-label="Zvětšit: ${escape(text)}"><img src="${escape(href)}" alt="${escape(text)}" width="${Number(width)}" height="${Number(height)}" loading="lazy" decoding="async"></a><figcaption>${escape(text)} <span>· Kliknutím zvětšíte</span></figcaption></figure>`;
    },
  } });
  const dom = new JSDOM('<!doctype html><body></body>');
  const document = dom.window.document;
  const purify = createDOMPurify(dom.window);
  const article = document.createElement('article');
  article.innerHTML = purify.sanitize(parser.parse(markdown), { ADD_ATTR: ['loading', 'decoding'], FORBID_TAGS: ['style', 'form', 'input', 'iframe'], FORBID_ATTR: ['style'] });
  const wrapper = document.createElement('div');
  let current = document.createElement('div');
  current.className = 'introduction'; wrapper.append(current);
  for (const child of [...article.childNodes]) {
    if (child.nodeName === 'H2') {
      current = document.createElement('section');
      current.id = child.id; child.removeAttribute('id');
      current.className = 'chapter';
      child.id = `${current.id}-title`;
      current.setAttribute('aria-labelledby', child.id);
      wrapper.append(current);
    }
    current.append(child);
  }
  const existing = new Set([...wrapper.querySelectorAll('[id]')].map(el => el.id));
  for (const [alias, destination] of Object.entries(aliases)) {
    if (existing.has(alias)) continue;
    const target = [...wrapper.querySelectorAll('.chapter')].find(el => el.id === destination);
    if (!target) throw new Error(`Missing legacy anchor destination: ${alias} -> ${destination}`);
    const anchor = document.createElement('span'); anchor.id = alias; anchor.className = 'legacy-anchor';
    target.prepend(anchor); existing.add(alias);
  }
  const nav = headings.filter(h => h.level === 2 || h.level === 3).map(h => {
    const label = document.createElement('span');
    label.innerHTML = purify.sanitize(h.text);
    return `<a class="nav-level-${h.level}" href="#${h.id}">${escape(label.textContent)}</a>`;
  }).join('\n');
  const result = `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tender Flow — Uživatelská příručka</title><meta name="description" content="Praktické návody Tender Flow: od první stavby k nabídce a smlouvě. Příklady se syntetickými daty a skutečné snímky aplikace.">
<link rel="icon" href="./assets/logo.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&display=swap" rel="stylesheet"><link rel="stylesheet" href="./manual.css"><script src="./manual.js" defer></script></head>
<body><a class="skip-link" href="#manual-content">Přejít k obsahu</a>
<header class="topbar"><a class="brand" href="#manual-content"><img src="./assets/logo.svg" alt="" width="34" height="34">Tender Flow <span>Příručka</span></a><div><a data-web-home href="/" hidden>Zpět na web ↗</a><button type="button" id="print-manual">Tisk / PDF</button></div></header>
<div class="layout"><aside class="sidebar"><p class="eyebrow">PRŮVODCE APLIKACÍ</p><label class="search-label" for="manual-search">Co potřebujete udělat?</label><input id="manual-search" type="search" aria-label="Hledat v příručce" placeholder="Např. příjemce poptávky" autocomplete="off"><p id="search-status" role="status" aria-live="polite"></p><button type="button" id="toggle-contents" aria-expanded="false" aria-controls="manual-nav">Obsah příručky ↓</button><nav id="manual-nav" aria-label="Obsah příručky">${nav}</nav><p class="sidebar-note">Ověřeno pro v${escape(version)}<br>Syntetická ukázková data</p></aside>
<main id="manual-content" tabindex="-1"><div class="hero"><p class="eyebrow">OD PRVNÍ STAVBY K PODPISU SMLOUVY</p><h1>Jasný postup.<br><span>V každém kroku.</span></h1><p>Seznamte se s Tender Flow na jedné ukázkové stavbě. Konkrétní úkoly, srozumitelné návody a obrazovky, podle kterých se zorientujete.</p><div class="hero-actions"><a class="button-primary" href="#rychly-start">Začít s ukázkovou stavbou ↗</a><a href="#vyberova-rizeni">Přejít k výběrovým řízením →</a></div><div class="hero-meta"><span>Verze ${escape(version)}</span><span>Aktualizováno ${escape(reviewDate)}</span><span>Web i desktop</span></div></div>
<div class="journey" aria-label="Postup práce"><a href="#sprava-staveb"><span>01</span> Založit stavbu</a><a href="#plan-vr"><span>02</span> Naplánovat VŘ</a><a href="#vyberova-rizeni"><span>03</span> Porovnat nabídky</a><a href="#smlouvy"><span>04</span> Uzavřít smlouvu</a></div>
<div id="search-empty" hidden><h2>Nic jsme nenašli.</h2><p>Zkuste kratší výraz, například „smlouva“ nebo „příjemce“.</p><button type="button" id="clear-search">Zobrazit celou příručku</button></div>
<article id="manual-article">${wrapper.innerHTML}</article><footer>Příručka Tender Flow · Ukázkové firmy, osoby i částky jsou fiktivní. <a href="#manual-content">Zpět nahoru ↑</a></footer></main></div>
<dialog id="screenshot-dialog" aria-label="Zvětšený snímek aplikace"><button type="button" id="close-screenshot" autofocus>Zavřít ×</button><img alt=""><p></p></dialog></body></html>`;
  dom.window.close();
  return result;
}

async function main() {
  const markdown = await fs.readFile('public/user-manual/index.md', 'utf8');
  const aliases = JSON.parse(await fs.readFile('docs/user-manual/legacy-anchors.json', 'utf8'));
  const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'));
  const review = JSON.parse(await fs.readFile('docs/user-manual/review.json', 'utf8'));
  if (version !== review.appVersion) console.warn(`Manual reviewed for ${review.appVersion}; application is ${version}. Review content before updating its version.`);
  const imageSizes = {};
  for (const match of markdown.matchAll(/!\[[^\]]*\]\((\.\/assets\/[a-zA-Z0-9._-]+\.png)\)/g)) {
    const buffer = await fs.readFile(path.join('public/user-manual', match[1]));
    if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error(`Invalid PNG: ${match[1]}`);
    imageSizes[match[1]] = { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  await fs.writeFile('public/user-manual/index.html', buildManualHtml(markdown, { version: review.appVersion, reviewedAt: review.reviewedAt, aliases, imageSizes }));
  await fs.writeFile('public/user-manual/index.kb.json', JSON.stringify({ generatedAt: new Date().toISOString(), source: '/public/user-manual/index.md', entries: extractManualKbEntries(markdown) }, null, 2) + '\n');
  console.log('Generated manual HTML and knowledge base.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error); process.exitCode = 1; });
