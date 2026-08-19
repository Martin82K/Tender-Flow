import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260819193000_guard_duplicate_subcontractor_names.sql",
  ),
  "utf8",
);

const unchangedIdentityUpdateMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260819194500_allow_unchanged_legacy_subcontractor_identity_updates.sql",
  ),
  "utf8",
);

const postGuardMigrations = fs
  .readdirSync(path.join(process.cwd(), "supabase/migrations"))
  .filter((fileName) => fileName >= "20260819194500" && fileName.endsWith(".sql"))
  .map((fileName) => fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations", fileName),
    "utf8",
  ))
  .join("\n");

describe("subcontractor name conflict migration", () => {
  it("normalizuje název a blokuje konflikt standardní chybou unikátnosti", () => {
    expect(migration).toContain("NORMALIZE(BTRIM(company_name_input), NFKC)");
    expect(migration).toContain("ERRCODE = '23505'");
    expect(migration).toContain("MESSAGE = 'SUBCONTRACTOR_NAME_CONFLICT'");
    expect(migration).toContain("CONSTRAINT = 'subcontractors_tenant_company_name_key'");
    expect(migration).toContain("BEFORE INSERT OR UPDATE OF company_name, owner_id, organization_id");
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(migration).toContain("pg_catalog.hashtextextended");
  });

  it("odděluje organizační a osobní tenant scope", () => {
    expect(migration).toContain("existing.organization_id = NEW.organization_id");
    expect(migration).toContain("existing.owner_id IS NOT DISTINCT FROM NEW.owner_id");
    expect(migration).toContain("WHERE organization_id IS NOT NULL");
    expect(migration).toContain("WHERE organization_id IS NULL");
  });

  it("nepřepisuje ani nemaže existující kontakty a trigger neobchází RLS nekontrolovaným vstupem", () => {
    expect(migration).not.toMatch(/(?:DELETE|UPDATE)\s+(?:FROM\s+)?public\.subcontractors/i);
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain("SET row_security = off");
    expect(migration).toContain("REVOKE ALL ON FUNCTION private.guard_subcontractor_company_name_conflict()");
  });

  it("povolí UPDATE historické duplicity, pokud se normalizovaný název ani tenant nezměnil", () => {
    expect(unchangedIdentityUpdateMigration).toContain(
      "CREATE OR REPLACE FUNCTION private.guard_subcontractor_company_name_conflict()",
    );
    expect(unchangedIdentityUpdateMigration).toContain("TG_OP = 'UPDATE'");
    expect(unchangedIdentityUpdateMigration).toContain(
      "public.normalize_subcontractor_company_identity(OLD.company_name)",
    );
    expect(unchangedIdentityUpdateMigration).toContain(
      "NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id",
    );
    expect(unchangedIdentityUpdateMigration).toContain(
      "NEW.owner_id IS NOT DISTINCT FROM OLD.owner_id",
    );
    expect(unchangedIdentityUpdateMigration).toMatch(/TG_OP = 'UPDATE'[\s\S]*RETURN NEW;/);
  });

  it("obnoví historické duplicity bez vypnutí databázového guardu", () => {
    expect(postGuardMigrations).toContain(
      "prepare_subcontractor_restore_payload",
    );
    expect(postGuardMigrations).toContain(
      "restore_user_backup_without_identity_dedup_20260819",
    );
    expect(postGuardMigrations).toContain(
      "restore_tenant_backup_without_identity_dedup_20260819",
    );
    expect(postGuardMigrations).toMatch(/company_name[\s\S]*obnoveno/i);
    expect(postGuardMigrations).toContain("REVOKE ALL ON FUNCTION private.prepare_subcontractor_restore_payload");
    expect(postGuardMigrations).not.toMatch(/DISABLE\s+TRIGGER/i);
  });
});
