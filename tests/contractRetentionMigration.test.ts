import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const sql = readFileSync('supabase/migrations/20260914184053_retention_release_evidence.sql', 'utf8');
describe('retention evidence security boundary', () => {
  it('keeps confirmation under RLS and explicitly checks project write permission', () => {
    const rpc = sql.split('CREATE FUNCTION public.release_contract_retention')[1];
    expect(rpc).toContain('SECURITY INVOKER');
    expect(rpc).toContain('FOR UPDATE');
    expect(rpc).toContain("SET timezone = 'UTC'");
    expect(rpc).toContain('auth.uid() IS NULL');
    expect(rpc).toContain("public.can_project_module_action(c.project_id::text,'module_contracts',true)");
    expect(rpc).toContain('IF NOT FOUND');
    expect(rpc).toContain("ERRCODE='40001'");
    expect(rpc).toContain('FROM PUBLIC,anon,authenticated');
  });
  it('limits elevated code to private audit triggers and makes audit rows client read-only', () => {
    expect(sql).toContain('ALTER TABLE public.contract_retention_events ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('REVOKE ALL ON public.contract_retention_events FROM anon, authenticated');
    expect(sql).not.toMatch(/GRANT (?:ALL|INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
    expect(sql).not.toContain('user_metadata');
    expect(sql).toContain("SECURITY DEFINER SET search_path = ''");
  });
  it('backfills plans only for unreleased records without guessing lost dates', () => {
    expect(sql).toContain("CASE WHEN retention_short_status IS DISTINCT FROM 'released' THEN retention_short_release_on END");
    expect(sql).toContain("CASE WHEN retention_long_status IS DISTINCT FROM 'released' THEN retention_long_release_on END");
  });
});

it('selects a fixture with active subscription and write permission before running authenticated SQL tests', () => {
  const fixture = readFileSync('supabase/tests/retention_release_evidence.sql', 'utf8');
  expect(fixture).toContain("IF public.has_active_subscription() AND public.can_project_module_action(candidate.project_id::text,'module_contracts',true)");
  expect(fixture).not.toContain('LIMIT 1');
});
