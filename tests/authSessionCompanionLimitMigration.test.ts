import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const MIGRATION = '20260507103000_allow_mobile_companion_session.sql';

const readMigration = (): string =>
  fs.readFileSync(path.join(ROOT, 'supabase/migrations', MIGRATION), 'utf8');

describe('migrace mobilní doprovodné session', () => {
  const sql = readMigration();

  it('klasifikuje mobilní user agenty odděleně od desktopu', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_auth_session_client_kind');
    expect(sql).toContain('iphone|ipad|ipod|android|mobile|windows phone|iemobile|opera mini|blackberry');
    expect(sql).toContain("THEN 'mobile'");
    expect(sql).toContain("ELSE 'desktop'");
  });

  it('maže pouze starší sessions ve stejné třídě zařízení', () => {
    expect(sql).toContain('DELETE FROM auth.sessions existing_session');
    expect(sql).toContain('existing_session.user_id = NEW.user_id');
    expect(sql).toContain('existing_session.id <> NEW.id');
    expect(sql).toContain("to_jsonb(existing_session) ->> 'user_agent'");
    expect(sql).toContain('= new_client_kind');
    expect(sql).not.toContain('AND id <> new.id;');
  });

  it('ponechává trigger jako security definer s fixním search_path', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.handle_new_session()');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('SET search_path = public');
    expect(sql).toContain('AFTER INSERT ON auth.sessions');
  });

  it('dokumentuje, že user agent není bezpečnostní atestace zařízení', () => {
    expect(sql).toContain('ne bezpečnostní atestace zařízení');
    expect(sql).toContain('Supabase Auth + RLS');
  });
});
