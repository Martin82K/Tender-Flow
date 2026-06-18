import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const readPackageVersion = () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    return packageJson.version;
};

export const parseArgs = (args) => {
    const parsed = {
        dir: 'dist-electron',
        version: readPackageVersion(),
    };

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--dir') {
            parsed.dir = args[index + 1];
            index += 1;
        } else if (arg === '--version') {
            parsed.version = args[index + 1];
            index += 1;
        }
    }

    return parsed;
};

export const parseWindowsLatestYml = (content) => {
    const version = content.match(/^version:\s*(.+)$/m)?.[1]?.trim();
    const path = content.match(/^path:\s*(.+)$/m)?.[1]?.trim();
    const sha512 = content.match(/^sha512:\s*(.+)$/m)?.[1]?.trim();
    const sizeText = content.match(/^\s+size:\s*(\d+)$/m)?.[1];
    const fileUrl = content.match(/^\s+-\s+url:\s*(.+)$/m)?.[1]?.trim();

    return {
        version,
        path,
        sha512,
        size: sizeText ? Number(sizeText) : undefined,
        fileUrl,
    };
};

export const createSha512Base64 = (filePath) => {
    const content = readFileSync(filePath);
    return createHash('sha512').update(content).digest('base64');
};

export const verifyReleaseArtifacts = ({ dir, version }) => {
    const errors = [];
    const latestPath = join(dir, 'latest.yml');

    if (!existsSync(latestPath)) {
        errors.push(`Missing ${latestPath}. Windows auto-update will fail with GitHub 404.`);
        return errors;
    }

    const latest = parseWindowsLatestYml(readFileSync(latestPath, 'utf-8'));
    if (latest.version !== version) {
        errors.push(`latest.yml version is ${latest.version || 'missing'}, expected ${version}.`);
    }

    if (!latest.path) {
        errors.push('latest.yml is missing top-level path.');
        return errors;
    }

    if (latest.fileUrl && latest.fileUrl !== latest.path) {
        errors.push(`latest.yml files[0].url (${latest.fileUrl}) does not match path (${latest.path}).`);
    }

    const installerPath = join(dir, latest.path);
    if (!existsSync(installerPath)) {
        errors.push(`Missing installer referenced by latest.yml: ${installerPath}.`);
        return errors;
    }

    const installerName = basename(installerPath);
    if (!installerName.includes(version)) {
        errors.push(`Installer name ${installerName} does not include expected version ${version}.`);
    }

    const actualSize = statSync(installerPath).size;
    if (latest.size !== actualSize) {
        errors.push(`latest.yml size is ${latest.size || 'missing'}, expected ${actualSize}.`);
    }

    const actualSha512 = createSha512Base64(installerPath);
    if (latest.sha512 !== actualSha512) {
        errors.push('latest.yml sha512 does not match the referenced installer.');
    }

    return errors;
};
