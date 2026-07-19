import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/quality.yml'),
  'utf8',
);

const getStep = (name: string): string => {
  const marker = `      - name: ${name}\n`;
  const start = workflow.indexOf(marker);
  expect(start, `missing workflow step: ${name}`).toBeGreaterThanOrEqual(0);

  const next = workflow.indexOf('\n      - name:', start + marker.length);
  return workflow.slice(start, next === -1 ? undefined : next);
};

describe('Quality workflow supply-chain gates', () => {
  it('audits root dependencies and signatures fail-closed before tests', () => {
    const vulnerabilityAudit = getStep('Audit root dependencies');
    const signatureAudit = getStep('Verify root registry signatures');

    expect(vulnerabilityAudit).toContain(
      'run: npm audit --audit-level=high',
    );
    expect(signatureAudit).toContain('run: npm audit signatures');
    expect(vulnerabilityAudit).not.toContain('continue-on-error: true');
    expect(signatureAudit).not.toContain('continue-on-error: true');

    expect(workflow.indexOf('run: npm ci')).toBeLessThan(
      workflow.indexOf('run: npm audit --audit-level=high'),
    );
    expect(workflow.indexOf('run: npm audit signatures')).toBeLessThan(
      workflow.indexOf('run: npm run test:run'),
    );
  });

  it('audits installed desktop dependencies and signatures fail-closed', () => {
    const vulnerabilityAudit = getStep('Audit desktop dependencies');
    const signatureAudit = getStep('Verify desktop registry signatures');

    expect(vulnerabilityAudit).toContain(
      'run: npm audit --prefix desktop --audit-level=high',
    );
    expect(signatureAudit).toContain(
      'run: npm audit signatures --prefix desktop',
    );
    expect(vulnerabilityAudit).not.toContain('continue-on-error: true');
    expect(signatureAudit).not.toContain('continue-on-error: true');

    expect(workflow.indexOf('run: npm run desktop:compile')).toBeLessThan(
      workflow.indexOf('run: npm audit --prefix desktop --audit-level=high'),
    );
  });
});
