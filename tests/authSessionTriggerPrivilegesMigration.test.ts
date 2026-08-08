import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase/migrations");
const MIGRATION_SUFFIX = "_revoke_session_trigger_execute.sql";

const readMigration = (): string => {
  const migration = fs.readdirSync(MIGRATIONS_DIR).find((file) => file.endsWith(MIGRATION_SUFFIX));
  if (!migration) throw new Error(`Chybí migrace *${MIGRATION_SUFFIX}`);
  return fs.readFileSync(path.join(MIGRATIONS_DIR, migration), "utf8");
};

describe("oprávnění triggeru aktivních session", () => {
  it("odebere přímé spuštění všem API rolím", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.handle_new_session() FROM PUBLIC, anon, authenticated, service_role;",
    );
  });

  it("nemění existující session ani definici triggeru", () => {
    const sql = readMigration();

    expect(sql).not.toMatch(/DELETE\s+FROM\s+auth\.sessions/i);
    expect(sql).not.toMatch(/DROP\s+TRIGGER/i);
    expect(sql).not.toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION/i);
  });
});
