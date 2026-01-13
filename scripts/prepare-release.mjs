#!/usr/bin/env node
/**
 * Prepare a new release
 * - Checks git status
 * - Shows current version
 * - Provides instructions for creating a release
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🚀 Tender Flow - Release Preparation\n');

try {
    // Read current version
    const packageJson = JSON.parse(
        readFileSync(join(rootDir, 'package.json'), 'utf-8')
    );
    const version = packageJson.version;

    console.log(`Current version: ${version}\n`);

    // Check git status
    try {
        const gitStatus = execSync('git status --porcelain', {
            cwd: rootDir,
            encoding: 'utf-8'
        });

        if (gitStatus.trim()) {
            console.log('⚠️  Warning: You have uncommitted changes:\n');
            console.log(gitStatus);
            console.log('\nPlease commit or stash your changes before creating a release.\n');
        } else {
            console.log('✓ Git working directory is clean\n');
        }
    } catch (error) {
        console.log('⚠️  Could not check git status\n');
    }

    console.log('📋 Next steps to create a release:\n');
    console.log('1. Ensure all changes are committed');
    console.log('2. Bump version if needed:');
    console.log('   - npm run version:patch  (for bug fixes: 1.0.0 → 1.0.1)');
    console.log('   - npm run version:minor  (for new features: 1.0.0 → 1.1.0)');
    console.log('   - npm run version:major  (for breaking changes: 1.0.0 → 2.0.0)');
    console.log('3. Commit version changes:');
    console.log(`   git add package.json config/version.ts`);
    console.log(`   git commit -m "chore: bump version to ${version}"`);
    console.log('4. Create and push tag:');
    console.log(`   git tag -a v${version} -m "Release v${version}"`);
    console.log('   git push origin main --tags');
    console.log('5. Build the application:');
    console.log('   npm run desktop:build:win');
    console.log('6. Upload to GitHub Releases:');
    console.log(`   https://github.com/Martin82K/Tender-Flow/releases/new?tag=v${version}`);
    console.log('   - Upload files from dist-electron folder');
    console.log('   - Add release notes');
    console.log('   - Publish release\n');

    console.log('💡 Tip: After publishing, the auto-updater will detect the new version!\n');

} catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
}
