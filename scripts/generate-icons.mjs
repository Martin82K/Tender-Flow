#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, copyFile, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import icongen from 'icon-gen';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const assets = resolve(root, 'assets');
const svgInput = resolve(assets, 'icon.svg');
const tmpDir = resolve(assets, '.icon-tmp');

if (!existsSync(svgInput)) {
    console.error(`Chybí vstupní SVG: ${svgInput}`);
    process.exit(1);
}

await rm(tmpDir, { recursive: true, force: true });
await mkdir(tmpDir, { recursive: true });

console.log(`Generuji ikony z ${svgInput}...`);

const results = await icongen(svgInput, tmpDir, {
    report: true,
    ico: { name: 'icon', sizes: [16, 24, 32, 48, 64, 128, 256] },
    icns: { name: 'icon', sizes: [16, 32, 64, 128, 256, 512, 1024] },
    favicon: false,
});

console.log('Vygenerováno:', results);

await copyFile(resolve(tmpDir, 'icon.ico'), resolve(assets, 'icon.ico'));
await copyFile(resolve(tmpDir, 'icon.icns'), resolve(assets, 'icon.icns'));

const linuxDir = resolve(assets, 'icons');
await mkdir(linuxDir, { recursive: true });
const svgBuffer = await readFile(svgInput);
for (const size of [16, 32, 48, 64, 128, 256, 512]) {
    await sharp(svgBuffer)
        .png({ compressionLevel: 9 })
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toFile(resolve(linuxDir, `${size}x${size}.png`));
}

await rm(tmpDir, { recursive: true, force: true });

console.log('Hotovo: assets/icon.ico, assets/icon.icns, assets/icons/*.png');
