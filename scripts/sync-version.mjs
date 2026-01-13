#!/usr/bin/env node
/**
 * Synchronize version from package.json to config/version.ts
 * This ensures version is consistent across the application
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

try {
    // Read version from package.json
    const packageJson = JSON.parse(
        readFileSync(join(rootDir, 'package.json'), 'utf-8')
    );
    const version = packageJson.version;

    // Update config/version.ts
    const versionFileContent = `export const APP_VERSION = "${version}";\n`;
    writeFileSync(
        join(rootDir, 'config', 'version.ts'),
        versionFileContent,
        'utf-8'
    );

    console.log(`✓ Version synchronized: ${version}`);
    console.log(`  - package.json: ${version}`);
    console.log(`  - config/version.ts: ${version}`);
} catch (error) {
    console.error('✗ Failed to sync version:', error.message);
    process.exit(1);
}
