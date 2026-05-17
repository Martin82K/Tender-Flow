import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const MIGRATION = "20260511184500_harden_tenant_isolation_writes.sql";

const readMigration = (): string =>
  fs.readFileSync(path.join(ROOT, "supabase/migrations", MIGRATION), "utf8");

describe("tenant isolation write hardening migration", () => {
  it("zpevňuje maybe_create_org_join_request proti spoofingu a public execute", () => {
    const migration = readMigration();

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.maybe_create_org_join_request(user_id_input UUID, email_input TEXT)");
    expect(migration).toContain("COALESCE(auth.role(), '') <> 'service_role' AND pg_trigger_depth() = 0");
    expect(migration).toContain("SELECT lower(trim(u.email))");
    expect(migration).toContain("auth_user_email <> normalized_email");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.maybe_create_org_join_request(UUID, TEXT) FROM PUBLIC;");
    expect(migration).toContain("REVOKE EXECUTE ON FUNCTION public.maybe_create_org_join_request(UUID, TEXT) FROM authenticated;");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.maybe_create_org_join_request(UUID, TEXT) TO service_role;");
  });

  it("chrání projects update před přesunem do cizí organizace", () => {
    const migration = readMigration();

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.can_update_project_organization");
    expect(migration).toContain("current_org_id IS NOT DISTINCT FROM organization_id_input");
    expect(migration).toContain("AND public.is_org_member(organization_id_input)");
    expect(migration).toContain('CREATE POLICY "Projects update for owner or shared editor"');
    expect(migration).toContain("WITH CHECK (");
    expect(migration).toContain("public.can_update_project_organization(id, organization_id)");
  });

  it("vyžaduje u subcontractors konzistentní owner a tenant membership pro insert i update", () => {
    const migration = readMigration();

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.can_write_subcontractor_tenant");
    expect(migration).toContain("owner_id_input IS NULL");
    expect(migration).toContain("organization_id_input IS NULL");
    expect(migration).toContain("RETURN owner_id_input = auth.uid();");
    expect(migration).toContain("caller.organization_id = organization_id_input");
    expect(migration).toContain("owner_member.organization_id = organization_id_input");
    expect(migration).toContain("owner_member.user_id = owner_id_input");
    expect(migration).toContain('CREATE POLICY "Subcontractors insert restricted to owner or org"');
    expect(migration).toContain('CREATE POLICY "Manage own or org subcontractors"');
    expect(migration).toContain("public.can_write_subcontractor_tenant(owner_id, organization_id)");
  });
});
