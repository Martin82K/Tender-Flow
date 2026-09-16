import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildManualHtml } from '../scripts/build-user-manual.mjs';
import { JSDOM } from 'jsdom';

describe('návrat z webové a zabalené desktopové příručky', () => {
  it.each(['file:///app/dist/user-manual/index.html', 'https://example.com/user-manual/'])('používá bezpečné odkazy při načtení z %s', url => {
    const dom = new JSDOM(buildManualHtml('## Úvod\nText', { version: '1' }), { url, runScripts: 'outside-only' });
    try {
      dom.window.eval(readFileSync('public/user-manual/manual.js', 'utf8'));
      const brand = dom.window.document.querySelector('.brand');
      expect(brand?.getAttribute('href')).toBe('#manual-content');
      const home = dom.window.document.querySelector<HTMLAnchorElement>('[data-web-home]');
      expect(home).not.toBeNull();
      expect(home?.hidden).toBe(url.startsWith('file:'));
      expect(dom.window.document.querySelectorAll('.topbar a:not([hidden])[href="/"]').length).toBe(url.startsWith('file:') ? 0 : 1);
    } finally { dom.window.close(); }
  });
});

// Execute the delivered script against its generated DOM, not a separate implementation.
describe('hledání v doručené příručce', () => {
  beforeEach(() => {
    const html = buildManualHtml('## Poptávky\nPříjemce poptávky Anna\n## Smlouvy\nPropojení výběrových řízení', { version: '1', aliases: { stary: 'smlouvy' } });
    document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
    window.eval(readFileSync('public/user-manual/manual.js', 'utf8'));
  });
  afterEach(() => { document.body.innerHTML = ''; });
  const search = (text: string) => {
    const input = document.getElementById('manual-search') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  it('hledá více slov i bez diakritiky a skryje nesouvisející kapitoly', () => {
    search('prijemce anna');
    expect(document.getElementById('poptavky')?.hidden).toBe(false);
    expect(document.getElementById('smlouvy')?.hidden).toBe(true);
    expect(document.getElementById('search-status')?.textContent).toBe('Nalezené kapitoly: 1 z 2');
  });
  it('zobrazí prázdný výsledek a dovolí obnovit celou příručku', () => {
    search('neexistujici');
    expect(document.getElementById('search-empty')?.hidden).toBe(false);
    document.getElementById('clear-search')?.click();
    expect(document.querySelectorAll('.chapter[hidden]')).toHaveLength(0);
    expect(document.activeElement?.id).toBe('manual-search');
  });
  it('dotaz nepovažuje za HTML a nezapíše jej do DOM jako element', () => {
    search('<img src=x onerror=alert(1)>');
    expect(document.querySelector('[onerror]')).toBeNull();
    expect(document.getElementById('search-empty')?.hidden).toBe(false);
  });
  it('při otevření starého odkazu odkryje kapitolu skrytou filtrem', () => {
    search('anna');
    const link = document.createElement('a'); link.href = '#stary'; document.body.append(link);
    link.click();
    expect(document.getElementById('smlouvy')?.hidden).toBe(false);
    expect((document.getElementById('manual-search') as HTMLInputElement).value).toBe('');
  });
  it('mobilní obsah má ovladatelný rozbalovací stav', () => {
    const toggle = document.getElementById('toggle-contents')!;
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById('manual-nav')?.classList.contains('is-open')).toBe(true);
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
