import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { buildManualHtml } from '../scripts/build-user-manual.mjs';

describe('uživatelská příručka', () => {
  it('zobrazuje datum ověření z metadat místo pevného data', () => {
    const html = buildManualHtml('## Úvod\nText', { version: '2.0.0', reviewedAt: '2026-10-20' });
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.querySelector('.hero-meta')?.textContent).toContain('20. 10. 2026');
    expect(document.querySelector('.hero-meta')?.textContent).not.toContain('16. 9. 2026');
  });
  it('používá aktuální výslednou paletu landing page včetně pozdějšího přepsání tokenů', () => {
    const landing = readFileSync('features/public/ui/landing-apex.css', 'utf8');
    const manual = readFileSync('public/user-manual/manual.css', 'utf8').split('}')[0];
    const value = (css: string, token: string) => [...css.matchAll(new RegExp(`${token}\\s*:\\s*([^;]+);`, 'g'))].at(-1)?.[1].trim();
    for (const [manualToken, landingToken] of Object.entries({ '--bg': '--bg', '--panel': '--bg-elevated', '--card': '--bg-card', '--text': '--white', '--muted': '--gray-1', '--accent': '--cta', '--line': '--border' })) {
      expect(value(manual, manualToken), manualToken).toBe(value(landing, landingToken));
    }
    expect(manual).toContain('color-scheme:light');
  });
  it('vytvoří samostatně dostupné kapitoly, navigaci a vyhledávání', () => {
    const html = buildManualHtml('# Příručka\n\n## Poptávky\nText\n\n### Příjemce\nPostup', { version: '1.9.36', aliases: {} });
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.querySelector('section#poptavky h2')?.textContent).toBe('Poptávky');
    expect(document.querySelector('a[href="#prijemce"]')).not.toBeNull();
    expect(document.querySelector('input[type="search"]')?.getAttribute('aria-label')).toBe('Hledat v příručce');
    expect(document.querySelector('script[src="./manual.js"]')).not.toBeNull();
  });

  it('zachová starý odkaz u odpovídající kapitoly a nevytváří duplicitní ID', () => {
    const html = buildManualHtml('# Příručka\n\n## Složkomat\nPopis', { version: '1', aliases: { dochub: 'slozkomat', slozkomat: 'slozkomat' } });
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.getElementById('dochub')?.closest('section')?.id).toBe('slozkomat');
    const ids = Array.from(document.querySelectorAll('[id]'), element => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('odstraní spustitelný obsah a nebezpečné odkazy z markdownu', () => {
    const html = buildManualHtml('## Test <img src=x onerror="alert(1)">\n<script>alert(1)</script>\n<img src=x onerror="alert(1)">\n[Odkaz](javascript:alert%281%29)', { version: '1', aliases: {} });
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.querySelector('main script, [onerror], a[href^="javascript:"]')).toBeNull();
  });

  it('veřejné screenshoty používají místní soubory a mají popis i odkaz na zvětšení', () => {
    const html = buildManualHtml('## Test\n![Výběr příjemce](./assets/prijemce.png)', { version: '1', aliases: {} });
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.querySelector('figure a')?.getAttribute('href')).toBe('./assets/prijemce.png');
    expect(document.querySelector('figcaption')?.textContent).toContain('Výběr příjemce');
    expect(Number(document.querySelector('figure img')?.getAttribute('width'))).toBeGreaterThan(0);
    expect(Number(document.querySelector('figure img')?.getAttribute('height'))).toBeGreaterThan(0);
  });

  it('každý odkaz znalostní báze míří na existující nadpis', () => {
    const document = new DOMParser().parseFromString(readFileSync('public/user-manual/index.html', 'utf8'), 'text/html');
    const kb = JSON.parse(readFileSync('public/user-manual/index.kb.json', 'utf8'));
    for (const entry of kb.entries) expect(document.getElementById(entry.source_anchor.slice(1)), entry.source_anchor).not.toBeNull();
  });

  it('všechny historické odkazy zůstávají dostupné a veřejné snímky existují', () => {
    const document = new DOMParser().parseFromString(readFileSync('public/user-manual/index.html', 'utf8'), 'text/html');
    const aliases = JSON.parse(readFileSync('docs/user-manual/legacy-anchors.json', 'utf8'));
    for (const id of Object.keys(aliases)) expect(document.getElementById(id), id).not.toBeNull();
    for (const img of document.querySelectorAll('article img')) {
      expect(existsSync(`public/user-manual/${img.getAttribute('src')}`)).toBe(true);
      expect(img.getAttribute('alt')?.length).toBeGreaterThan(10);
    }
    const ids = Array.from(document.querySelectorAll('[id]'), element => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
