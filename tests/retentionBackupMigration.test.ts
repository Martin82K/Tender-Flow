import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260915231450_restore_retention_backup_evidence.sql', 'utf8');
describe('retention backup authorization and compatibility', () => {
  it('uses a private transaction capability rather than a client-controlled setting', () => {
    expect(migration).toContain('PRIMARY KEY(transaction_id, contract_id)');
    expect(migration).toContain('REVOKE ALL ON private.contract_retention_restore_context FROM PUBLIC,anon,authenticated,service_role');
    expect(migration).toContain('transaction_id=txid_current() AND contract_id=NEW.id');
    expect(migration).not.toMatch(/DISABLE TRIGGER|session_replication_role|set_config/i);
  });
  it('checks organization, project and owner before authorizing a restore', () => {
    expect(migration).toContain('public.is_org_admin(org_id)');
    expect(migration).toContain('public.is_org_member(org_id)');
    expect(migration).toContain('existing.organization_id IS DISTINCT FROM org_id');
    expect(migration).toContain('existing.project_id IS DISTINCT FROM project.id');
    expect(migration).toContain('existing.owner_id IS DISTINCT FROM auth.uid()');
  });
  it('preserves existing audit and rejects foreign or conflicting event identifiers', () => {
    expect(migration).toContain("(event->>'contract_id')::uuid IS DISTINCT FROM cid");
    expect(migration).toContain("RAISE EXCEPTION 'Conflicting retention event'");
    expect(migration).not.toMatch(/DELETE FROM public.contract_retention_events|UPDATE public.contract_retention_events/i);
    expect(migration).toContain('ON CONFLICT(id) DO NOTHING');
  });
  it('enriches both manifests before recording their sizes and preserves missing legacy fields', () => {
    expect(migration).toContain("FOREACH scope IN ARRAY ARRAY['user','tenant']");
    expect(migration).toContain("replace(definition,'rec_counts := jsonb_build_object('");
    expect(migration).toContain("CASE WHEN existing.id IS NOT NULL THEN to_jsonb(existing) ELSE '{}'::jsonb END");
    expect(migration).toContain("NOT (item ? 'retention_short_expected_on') AND existing.id IS NULL");
  });
});
