// Use an existing Playwright installation. This script never installs dependencies.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
const moduleName = process.env.PLAYWRIGHT_MODULE;
if (!moduleName) throw new Error('Set PLAYWRIGHT_MODULE to an installed playwright entry file.');
const { chromium } = await import(pathToFileURL(path.resolve(moduleName)).href);
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1140, height: 1100 }, deviceScaleFactor: 1.5 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:4176' || ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return route.continue();
    errors.push(`Blocked external request: ${url.origin}`); return route.abort();
  });
  await page.goto('http://127.0.0.1:4176', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Nastavení stavby', exact: true }).click();
  const directory = 'public/user-manual/assets';
  const capture = async (selector, name) => page.locator(selector).screenshot({ path: `${directory}/${name}.png` });
  await capture('#navigation-shot', 'navigace');
  await capture('#bids-shot', 'nabidky');
  await page.getByRole('combobox', { name: 'Příjemce poptávky' }).click();
  await capture('#bids-shot', 'prijemce');
  await page.keyboard.press('Escape');
  await capture('#contract-shot', 'smlouva');
  await page.getByRole('button', { name: 'Odpojit Slaboproud', exact: true }).click();
  await capture('#contract-shot', 'odpojeni');
  await capture('#plan-shot', 'plan-vr');
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile('docs/user-manual/screenshots.json', JSON.stringify({ version: '1.9.36', capturedAt: '2026-09-16', source: 'docs/user-manual/preview.tsx', data: 'synthetic-only', screenshots: ['navigace', 'nabidky', 'prijemce', 'smlouva', 'odpojeni', 'plan-vr'].map(name => `assets/${name}.png`) }, null, 2) + '\n');
  console.log('Captured 6 production-component screenshots; no backend requests.');
} finally { await browser.close(); }
