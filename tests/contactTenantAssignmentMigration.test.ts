import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const MIGRATION =
  "20260820101425_assign_contacts_to_member_tenant.sql";

const readMigration = (): string =>
  fs.readFileSync(path.join(ROOT, "supabase/migrations", MIGRATION), "utf8");

describe("contact tenant assignment migration", () => {
  it("automaticky přiřadí osobní kontakt uživatele s jediným aktivním tenantem", () => {
    const migration = readMigration();

    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION private.assign_subcontractor_organization_from_owner()",
    );
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain("SET row_security = off");
    expect(migration).toMatch(
      /COUNT\(DISTINCT\s+active_membership\.organization_id\)/,
    );
    expect(migration).toMatch(
      /active_organization_count\s*=\s*1[\s\S]*NEW\.organization_id\s*:=\s*resolved_organization_id/,
    );
    expect(migration).toContain("SUBCONTRACTOR_ORGANIZATION_REQUIRED");
    expect(migration).toContain("BEFORE INSERT OR UPDATE");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION private.assign_subcontractor_organization_from_owner()",
    );
  });

  it("ponechá osobní scope jen uživateli bez aktivního tenantového členství", () => {
    const migration = readMigration();

    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION private.can_write_subcontractor_tenant",
    );
    expect(migration).toMatch(
      /organization_id_input IS NULL[\s\S]*owner_id_input\s*=\s*auth\.uid\(\)[\s\S]*NOT EXISTS[\s\S]*organization_members/,
    );
    expect(migration).toContain("COALESCE(personal_member.is_active, true) = true");
  });

  it("opraví pouze prokázané kontakty Baustavu a zachová aktivní duplicate guard", () => {
    const migration = readMigration();

    expect(migration).toContain("organization.name = 'Baustav'");
    expect(migration).toContain("organization.type = 'business'");
    expect(migration).toContain(
      "CREATE TEMP TABLE contact_tenant_repair_candidates",
    );
    expect(migration).toContain("LOCK TABLE public.subcontractors");
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS private.authorized_subcontractor_tenant_repairs",
    );
    expect(migration).toContain(
      "REVOKE ALL ON TABLE private.authorized_subcontractor_tenant_repairs",
    );
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION private.guard_subcontractor_company_name_conflict()",
    );
    expect(migration).not.toMatch(/DISABLE\s+TRIGGER/i);
    expect(migration).toMatch(
      /UPDATE public\.subcontractors AS subcontractor[\s\S]*FROM contact_tenant_repair_candidates AS candidate[\s\S]*subcontractor\.id = candidate\.id/,
    );
    expect(migration).toContain("ambiguous_contact_count");
    expect(migration).toContain("references_to_other_organizations");
    expect(migration).toContain("GET DIAGNOSTICS repaired_contact_count = ROW_COUNT");
  });

  it("neotevírá tenantovou hranici pomocí nové veřejné funkce", () => {
    const migration = readMigration();

    expect(migration).not.toContain(
      "CREATE OR REPLACE FUNCTION public.assign_subcontractor_organization_from_owner",
    );
    expect(migration).not.toMatch(/GRANT EXECUTE[\s\S]*assign_subcontractor_organization_from_owner/);
    expect(migration).not.toContain("TO authenticated\nUSING (TRUE)");
    expect(migration).not.toContain("TO anon\nUSING (TRUE)");
  });
});
