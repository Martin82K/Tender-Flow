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
});
