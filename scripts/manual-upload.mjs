import { readFileSync, statSync } from 'fs';
import { join, basename } from 'path';

const GITHUB_TOKEN = 'github_token'
const REPO_OWNER = 'Martin82K';
const REPO_NAME = 'Tender-Flow';
const TAG_NAME = 'v1.1.8';

const FILES_TO_UPLOAD = [
    'dist-electron/Tender Flow-1.1.8-arm64.dmg',
    'dist-electron/Tender Flow-1.1.8-arm64-mac.zip',
    'dist-electron/Tender Flow-1.1.8-arm64-mac.zip.blockmap',
    'dist-electron/latest-mac.yml'
];

async function upload() {
    console.log(`Getting release for tag ${TAG_NAME}...`);
    const releaseResponse = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${TAG_NAME}`, {
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'User-Agent': 'Node-Script',
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (!releaseResponse.ok) {
        throw new Error(`Failed to get release: ${releaseResponse.status} ${releaseResponse.statusText} - ${await releaseResponse.text()}`);
    }

    const release = await releaseResponse.json();
    const uploadUrlTemplate = release.upload_url;
    console.log(`Found release ID: ${release.id}`);

    for (const filePath of FILES_TO_UPLOAD) {
        const fileName = basename(filePath);
        const uploadUrl = uploadUrlTemplate.replace('{?name,label}', `?name=${encodeURIComponent(fileName)}`);
        const fileStats = statSync(filePath);
        const fileContent = readFileSync(filePath);

        console.log(`Uploading ${fileName} (${fileStats.size} bytes)...`);

        const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'User-Agent': 'Node-Script',
                'Content-Type': 'application/octet-stream',
                'Content-Length': fileStats.size.toString()
            },
            body: fileContent
        });

        if (!uploadResponse.ok) {
            // Check if it's already uploaded
            const errorText = await uploadResponse.text();
            if (uploadResponse.status === 422 && errorText.includes('already_exists')) {
                 console.log(`⚠️  ${fileName} already exists, skipping.`);
            } else {
                throw new Error(`Failed to upload ${fileName}: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
            }
        } else {
            console.log(`✅ ${fileName} uploaded successfully.`);
        }
    }
}

upload().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
