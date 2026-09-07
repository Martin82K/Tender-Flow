import { spawn } from 'node:child_process';
import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(path.join(os.tmpdir(), 'tf-project-ui-'));
const artifacts = process.env.PROJECT_UI_ARTIFACTS || await mkdtemp(path.join(os.tmpdir(), 'tf-project-ui-artifacts-'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let chrome, server, socket;
const pending = new Map();
const errors = [];
const failures = [];
const measurements = [];
let sequence = 0;
let sessionId;

const send = (method, params = {}, targetSession = sessionId) => new Promise((resolve, reject) => {
  const id = ++sequence;
  const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15_000);
  pending.set(id, { resolve, reject, timeout });
  socket.send(JSON.stringify({ id, method, params, ...(targetSession ? { sessionId: targetSession } : {}) }));
});
const evaluate = async (fn, arg) => {
  const result = await send('Runtime.evaluate', {
    expression: `(${fn.toString()})(${JSON.stringify(arg) ?? 'undefined'})`,
    returnByValue: true, awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description);
  return result.result.value;
};
const check = (ok, message) => { if (!ok) failures.push(message); };
const move = (x = 0, y = 0) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
const hover = async selector => {
  const point = await evaluate(selector => {
    const el = document.querySelector(selector);
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, selector);
  await move(point.x, point.y);
  await sleep(220);
  return point;
};
const click = async selector => {
  const point = await hover(selector);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
  }
  await sleep(30);
};
const key = async (key, code) => {
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key, windowsVirtualKeyCode: code });
};
const screenshot = async name => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(artifacts, `${name}.png`), Buffer.from(data, 'base64'));
};
const colors = selector => evaluate(selector => {
  const el = document.querySelector(selector);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d');
  const rgba = value => {
    context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  };
  const over = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] / 255 + bg[i] * (1 - fg[3] / 255));
  const parents = []; for (let e = el; e; e = e.parentElement) parents.unshift(e);
  let bg = [255, 255, 255];
  for (const e of parents) bg = over(rgba(getComputedStyle(e).backgroundColor), bg);
  const foreground = over(rgba(getComputedStyle(el).color), bg);
  const luminance = color => color.map(v => {
    v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
  }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const a = luminance(foreground), b = luminance(bg);
  return { bg, foreground, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
}, selector);

try {
  // Only fixture services are stubbed. The UI and full production stylesheet are real.
  const fixtureConfig = {
    configFile: false, root: path.join(root, 'tests/browser/project-ui'), publicDir: false,
    cacheDir: path.join(temporary, 'cache'), logLevel: 'warn',
    plugins: [react(), {
      name: 'project-ui-fixture-services', enforce: 'pre',
      resolveId(id) {
        if (id.endsWith('/services/templateService')) return '\0fixture-templates';
        if (id.endsWith('/model/useDocHubIntegration')) return '\0fixture-dochub';
        if (id.endsWith('/routing/router')) return '\0fixture-router';
      },
      load(id) {
        if (id === '\0fixture-templates') return 'export const getProjectTemplateSelection=async()=>undefined;export const getTemplateById=async()=>undefined;export const saveProjectTemplateSelection=async()=>{};export const getTemplates=async()=>[];export const getDefaultTemplate=async()=>undefined;export const saveTemplate=async()=>undefined;export const deleteTemplate=async()=>false;';
        if (id === '\0fixture-dochub') return 'export const useDocHubIntegration=()=>({state:{isConnected:false,links:{},structureDraft:{}},actions:{},setters:{}});';
        if (id === '\0fixture-router') return 'export const useLocation=()=>({search:""});export const navigate=()=>{};';
      },
    }],
    resolve: { alias: Object.fromEntries([['@', ''], ['@app', 'app'], ['@features', 'features'], ['@shared', 'shared'], ['@infra', 'infra']].map(([alias, dir]) => [alias, path.join(root, dir)])) },
    css: { postcss: root },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://ci-placeholder.supabase.co'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('e30.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl'),
    },
    build: { outDir: path.join(temporary, 'dist'), emptyOutDir: true },
    preview: { host: '127.0.0.1', port: 0 },
  };
  await build(fixtureConfig);
  server = await preview(fixtureConfig);
  await mkdir(artifacts, { recursive: true });
  const candidates = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  let executable;
  for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch {} }
  if (!executable) throw new Error('Chrome/Chromium is required. Set CHROME_BIN to an installed executable.');
  chrome = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions', '--disable-sync', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${path.join(temporary, 'profile')}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((resolve, reject) => {
    let stderr = '';
    const timeout = setTimeout(() => reject(new Error('Chrome did not start its local debugging endpoint.')), 15_000);
    chrome.once('error', error => { clearTimeout(timeout); reject(error); });
    chrome.once('exit', code => { clearTimeout(timeout); reject(new Error(`Chrome exited before ready (${code}): ${stderr.slice(-2000)}`)); });
    chrome.stderr.on('data', chunk => {
      stderr = (stderr + chunk.toString()).slice(-5000);
      const match = stderr.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  socket = new WebSocket(endpoint);
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id); pending.delete(message.id); clearTimeout(entry.timeout);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error))); else entry.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) errors.push(message.params.args.map(arg => arg.value || arg.description).join(' '));
    if (message.method === 'Network.loadingFailed') errors.push(message.params.errorText);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) errors.push(`HTTP ${message.params.response.status}: ${message.params.response.url}`);
  });
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  ({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }));
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 1100, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: server.resolvedUrls.local[0] });
  let ready = false;
  for (let i = 0; i < 100; i++) { ready = await evaluate(() => Boolean(document.querySelector('#documents-tab-pd'))); if (ready) break; await sleep(100); }
  if (!ready) throw new Error(`Fixture did not render: ${errors.join('; ')}`);
  await evaluate(() => document.fonts.ready.then(() => true));
  for (const width of [240, 280, 360]) {
    const cards = await evaluate(width => {
      document.querySelectorAll('.fixture-column').forEach(el => { el.style.width = `${width}px`; });
      return [...document.querySelectorAll('.tf-kanban-bid-card')].map(card => {
        const bounds = card.getBoundingClientRect(), header = card.firstElementChild, name = header.querySelector('h3'), badge = header.querySelector(':scope > span');
        const inside = el => { const r = el.getBoundingClientRect(); return r.left >= bounds.left && r.right <= bounds.right + 1 && el.scrollWidth <= el.clientWidth + 1; };
        return { name: name.textContent, cardWidth: card.clientWidth, scrollWidth: card.scrollWidth, headerInside: inside(header), nameInside: inside(name), badgeInside: inside(badge) };
      });
    }, width);
    measurements.push({ width, cards });
    cards.forEach(card => check(card.headerInside && card.nameInside && card.badgeInside && card.scrollWidth <= card.cardWidth + 1, `Overflow at ${width}px: ${card.name}`));
  }
  const selected = '#documents-tab-pd', other = '#documents-tab-ceniky';
  const delta = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  for (const dark of [false, true]) for (const skin of ['basic', 'industrial', 'classic', 'botanica', 'nature', 'space']) {
    await evaluate(({ dark, skin }) => { document.documentElement.classList.toggle('dark', dark); document.documentElement.dataset.skin = skin; }, { dark, skin });
    await click(selected); await move(); await sleep(220);
    const active = await colors(selected), icon = await colors(`${selected} .material-symbols-outlined`), normal = await colors(other);
    await hover(other); const hovered = await colors(other);
    const state = { skin, dark, active, icon, normal, hovered };
    measurements.push(state);
    check(active.contrast >= 4.5 && icon.contrast >= 4.5 && hovered.contrast >= 4.5, `Tab contrast: ${skin}/${dark}`);
    check(delta(active.bg, normal.bg) >= 20 && delta(hovered.bg, normal.bg) >= 10, `Tab state distinction: ${skin}/${dark}`);
    if (skin === 'basic' && dark) await screenshot('basic-dark');
    await click(other);
    check(await evaluate(() => document.querySelector('#documents-tab-ceniky').getAttribute('aria-selected') === 'true' && document.querySelector('[role="tabpanel"]').getAttribute('aria-labelledby') === 'documents-tab-ceniky'), `Tab selection: ${skin}/${dark}`);
    await evaluate(selector => document.querySelector(selector).focus(), selected); await key('Tab', 9);
    check(await evaluate(() => { const style = getComputedStyle(document.activeElement); return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2; }), `Tab focus: ${skin}/${dark}`);
  }
  await evaluate(selector => document.querySelector(selector).focus(), other); await key('Enter', 13);
  check(await evaluate(() => document.querySelector('#documents-tab-ceniky').getAttribute('aria-selected') === 'true'), 'Keyboard activation');
  for (const [selector, expected] of [['[aria-label="Upravit nabídku"]', 'edit'], ['[title="DocHub složka dodavatele"]', 'folder'], ['[title="Odebrat z výběrového řízení"]', 'delete']]) {
    await hover('.tf-kanban-bid-card'); await click(`.tf-kanban-bid-card ${selector}`);
    check(await evaluate(() => document.querySelector('#fixture-action').textContent) === expected, `Card action: ${expected}`);
  }
  await evaluate(() => { document.documentElement.style.zoom = '1.5'; });
  check(await evaluate(() => [...document.querySelectorAll('.tf-kanban-bid-card')].every(card => card.scrollWidth <= card.clientWidth + 1)), 'Overflow at 150% zoom');
  await evaluate(() => { document.documentElement.style.zoom = '1'; });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await click(selected); await screenshot('mobile');
  check(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ failures, errors, measurements }, null, 2));
  console.log(JSON.stringify({ checks: '3 widths × 3 cards; 12 theme/mode variants; hover, focus, keyboard, actions, zoom, mobile', failures, errors, artifacts }, null, 2));
  if (failures.length) process.exitCode = 1;
} catch (error) {
  console.error(error); process.exitCode = 1;
} finally {
  socket?.close();
  for (const entry of pending.values()) { clearTimeout(entry.timeout); entry.reject(new Error('Browser check ended')); }
  if (chrome && chrome.exitCode === null) {
    chrome.kill('SIGTERM');
    await Promise.race([new Promise(resolve => chrome.once('exit', resolve)), sleep(2000)]);
    if (chrome.exitCode === null) chrome.kill('SIGKILL');
  }
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
