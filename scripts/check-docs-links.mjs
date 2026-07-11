import process from 'node:process';

import { validateDocumentation } from './docs-link-checker.mjs';

const findings = validateDocumentation(process.cwd());

if (findings.length > 0) {
  console.error('Documentation contains broken local links:');
  for (const finding of findings) {
    console.error(`- ${finding.source}: ${finding.target}`);
  }
  process.exitCode = 1;
} else {
  console.log('Documentation links are valid.');
}
