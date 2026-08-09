import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase/migrations");
const MIGRATION_SUFFIX = "_limit_active_auth_sessions_to_three.sql";

const readMigration = (): string => {
  const migration = fs.readdirSync(MIGRATIONS_DIR).find((file) => file.endsWith(MIGRATION_SUFFIX));
  if (!migration) throw new Error(`Chybí migrace *${MIGRATION_SUFFIX}`);
  return fs.readFileSync(path.join(MIGRATIONS_DIR, migration), "utf8");
};

describe("limit tří aktivních přihlašovacích session", () => {
  it("ponechá tři nejnovější session uživatele bez omezení podle platformy", () => {
    const sql = readMigration();

    expect(sql).toContain("MAX_ACTIVE_SESSIONS CONSTANT INTEGER := 3");
    expect(sql).toContain("existing_session.user_id = NEW.user_id");
    expect(sql).toContain("OFFSET MAX_ACTIVE_SESSIONS");
    expect(sql).toContain("(existing_session.id = NEW.id) DESC");
    expect(sql).toContain("DROP FUNCTION IF EXISTS public.get_auth_session_client_kind(TEXT)");
    expect(sql).not.toContain("new_client_kind");
    expect(sql).not.toContain("user_agent");
  });

  it("serializuje souběžná přihlášení stejného uživatele", () => {
    const sql = readMigration();

    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("NEW.user_id::TEXT");
  });

  it("zachová bezpečnostní vlastnosti triggeru", () => {
    const sql = readMigration();

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.handle_new_session()");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = pg_catalog, public");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.handle_new_session() FROM PUBLIC");
    expect(sql).toContain("AFTER INSERT ON auth.sessions");
  });
});
