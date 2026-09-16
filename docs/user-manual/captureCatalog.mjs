import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';

if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Set PLAYWRIGHT_MODULE to an installed Playwright entry file.');
const { chromium } = await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href);
const allNames = JSON.parse(await readFile('docs/user-manual/catalog-screenshots.json', 'utf8'));
const names = process.argv.length > 2 ? process.argv.slice(2) : allNames;
if (names.some(name => !allNames.includes(name))) throw new Error('Unknown catalog screen.');
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const captured = [];
try {
  for (const name of names) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5 });
    // Leaflet fades tiles with Date.now(); freezing it would capture transparent tiles.
    if (name !== 'mapa') await page.clock.setFixedTime(new Date('2026-09-16T10:00:00Z'));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      const allowed = url.origin === 'http://127.0.0.1:4176'
        || ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)
        || (name === 'mapa' && /^[abc]\.tile\.openstreetmap\.org$/.test(url.hostname));
      if (allowed) return route.continue();
      errors.push(`Blocked unexpected request: ${url.origin}`);
      return route.abort();
    });
    if (name === 'biometrie') {
      await page.addInitScript(() => {
        // Read-only simulation of availability, not a native biometric test.
        window.electronAPI = {
          platform: { isDesktop: true, os: 'darwin' },
          biometric: { isAvailable: async () => true, prompt: async () => { throw new Error('Native verification is disabled in the documentation fixture.'); } },
          session: { isBiometricEnabled: async () => true },
        };
      });
    }
    await page.goto(`http://127.0.0.1:4176/catalog.html?screen=${name}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    if (['excel-odemceni', 'excel-spojeni'].includes(name)) {
      await page.locator('input[type="file"]').first().setInputFiles('public/user-manual/assets/javor-rozpocet.xlsx');
      if (name === 'excel-odemceni') {
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: /Odemknout soubor/ }).click();
        const result = await download;
        if (await result.failure()) throw new Error('Excel output download failed.');
      } else await page.getByText('Slaboproud', { exact: true }).waitFor();
    }
    if (name === 'excel-indexace') await page.getByRole('button', { name: 'settings', exact: true }).click();
    if (name === 'import-kontaktu') {
      await page.locator('input[type="file"]').setInputFiles('public/user-manual/assets/javor-kontakty.csv');
      await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();
      await page.getByText('Mapování sloupců', { exact: true }).waitFor();
    }
    if (name === 'mapa') await page.waitForFunction(() => {
      const tiles = [...document.querySelectorAll('.leaflet-tile')];
      return tiles.length > 0 && tiles.every(tile => tile instanceof HTMLImageElement && tile.complete && tile.naturalWidth > 0 && getComputedStyle(tile).opacity === '1');
    });
    if (name === 'ukoly') await page.getByRole('button', { name: /Nadcházející/ }).first().click();
    const bodyText = await page.locator('body').innerText();
    if (/Načítání ukázky…|Nejste přihlášen v aplikaci|Nepodařilo se načíst/.test(bodyText)) throw new Error(`Fixture not ready: ${name}`);
    if (errors.length) throw new Error(`${name}: ${errors.join('\n')}`);
    const dialog = page.getByRole('dialog');
    const legacyModal = ['kontakt-formular', 'vr-formular', 'nabidka-uprava'].includes(name);
    const output = `public/user-manual/assets/${name}.png`;
    if (legacyModal) await page.screenshot({ path: output });
    else await (await dialog.count() ? dialog.first() : page.locator('#catalog-shot')).screenshot({ path: output });
    captured.push(`assets/${name}.png`);
    console.log(`Captured ${name}; no unexpected requests or browser errors.`);
    await page.close();
  }
  const manifestPath = 'docs/user-manual/screenshots.json';
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.sources = ['docs/user-manual/preview.tsx', 'docs/user-manual/catalog.tsx'];
  manifest.screenshots = [...new Set([...manifest.screenshots, ...captured])];
  manifest.mapAttribution = 'Map screenshot uses OpenStreetMap public tiles; project and supplier positions are synthetic.';
  manifest.desktopSimulation = 'Biometric settings use production UI and synthetic availability, without invoking native verification.';
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
} finally {
  await browser.close();
}
