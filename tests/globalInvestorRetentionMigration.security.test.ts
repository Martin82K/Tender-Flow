import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260808083606_global_investor_retention.sql',
  ),
  'utf8',
);

describe('global investor retention migration', () => {
  it('používá NULL jako dědění globálních procent', () => {
    expect(migration).toContain('ALTER COLUMN retention_a_percent DROP NOT NULL');
    expect(migration).toContain('ALTER COLUMN retention_b_percent DROP NOT NULL');
    expect(migration).toContain('ALTER COLUMN retention_a_percent DROP DEFAULT');
    expect(migration).toContain('ALTER COLUMN retention_b_percent DROP DEFAULT');
  });

  it('převede jen snapshoty shodné s globální hodnotou a zachová výjimky', () => {
    expect(migration).toContain('FROM public.project_investor_financials AS financials');
    expect(migration).toContain('financials.project_id = invoice.project_id');
    expect(migration).toMatch(
      /WHEN invoice\.retention_a_percent = financials\.retention_a_percent THEN NULL/,
    );
    expect(migration).toMatch(
      /WHEN invoice\.retention_b_percent = financials\.retention_b_percent THEN NULL/,
    );
    expect(migration).toContain('ELSE invoice.retention_a_percent');
    expect(migration).toContain('ELSE invoice.retention_b_percent');
  });

  it('nemění tenantové politiky ani granty', () => {
    expect(migration).toContain(
      'ALTER TABLE public.project_investor_invoices ENABLE ROW LEVEL SECURITY',
    );
    expect(migration).not.toMatch(/DROP POLICY/i);
    expect(migration).not.toMatch(/CREATE POLICY/i);
    expect(migration).not.toMatch(/GRANT\s/i);
    expect(migration).not.toContain('service_role');
    expect(migration).not.toContain('owner_id IS NULL');
  });
});
