#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { parseArgs, verifyReleaseArtifacts } from './verify-release-artifacts-core.js';

export {
    createSha512Base64,
    parseArgs,
    parseWindowsLatestYml,
    verifyReleaseArtifacts,
} from './verify-release-artifacts-core.js';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const options = parseArgs(process.argv.slice(2));
    const errors = verifyReleaseArtifacts(options);

    if (errors.length > 0) {
        console.error('Release artifact verification failed:');
        for (const error of errors) {
            console.error(`- ${error}`);
        }
        process.exit(1);
    }

    console.log(`Release artifacts verified for ${options.version} in ${options.dir}`);
}
