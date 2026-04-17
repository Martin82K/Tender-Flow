import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const MIGRATION = '20260416120000_delete_org_member_account.sql';

const readMigration = (): string =>
  fs.readFileSync(path.join(ROOT, 'supabase/migrations', MIGRATION), 'utf8');

describe('delete_org_member_account migration', () => {
  const sql = readMigration();

  it('vytváří RPC funkci delete_org_member_account s třemi parametry', () => {
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.delete_org_member_account(',
    );
    expect(sql).toContain('org_id_input UUID');
    expect(sql).toContain('user_id_input UUID');
    expect(sql).toContain('confirmation_email TEXT');
  });

  it('běží jako SECURITY DEFINER s fixním search_path', () => {
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('SET search_path = public');
  });

  it('omezuje volání pouze na org.owner', () => {
    expect(sql).toMatch(/caller_role\s*<>\s*'owner'/);
    expect(sql).toContain("Only organization owner can delete user accounts");
  });

  it('blokuje smazání sebe sama', () => {
    expect(sql).toContain('Cannot delete your own account');
    expect(sql).toContain('user_id_input = auth.uid()');
  });

  it('blokuje smazání jiného ownera', () => {
    expect(sql).toContain('Cannot delete an owner');
    expect(sql).toMatch(/target_role\s*=\s*'owner'/);
  });

  it('blokuje hard-delete účtu, který patří do jiné organizace', () => {
    expect(sql).toContain('user belongs to another organization');
    expect(sql).toMatch(/om\.organization_id\s*<>\s*org_id_input/);
  });

  it('vyžaduje shodu potvrzovacího emailu', () => {
    expect(sql).toContain('Confirmation email does not match member email');
    expect(sql).toMatch(/LOWER\(COALESCE\(confirmation_email, ''\)\)\s*<>\s*LOWER\(target_email\)/);
  });

  it('převádí vlastnictví projektů a dodavatelů na org ownera', () => {
    expect(sql).toContain('UPDATE public.projects');
    expect(sql).toContain('SET owner_id = new_owner_id');
    expect(sql).toContain('UPDATE public.subcontractors');
  });

  it('anonymizuje usage events místo jejich smazání', () => {
    expect(sql).toContain('UPDATE public.feature_usage_events');
    expect(sql).toContain('SET user_id = NULL');
    expect(sql).toContain('UPDATE public.ai_voice_usage_events');
    expect(sql).toContain('UPDATE public.ai_agent_usage_events');
  });

  it('odebírá členství i případné join requesty', () => {
    expect(sql).toContain('DELETE FROM public.organization_members');
    expect(sql).toContain('DELETE FROM public.organization_join_requests');
  });

  it('povoluje EXECUTE pouze autentizovaným uživatelům', () => {
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.delete_org_member_account(UUID, UUID, TEXT) FROM PUBLIC',
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.delete_org_member_account(UUID, UUID, TEXT) TO authenticated',
    );
  });
});
