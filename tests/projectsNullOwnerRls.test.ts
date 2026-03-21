import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const readMigration = (name: string): string =>
  fs.readFileSync(path.join(ROOT, "supabase/migrations", name), "utf8");

describe("projects NULL-owner RLS hardening", () => {
  it("odstraňuje globální NULL-owner fallback z projects politik a metadata RPC", () => {
    const migration = readMigration("20260320180000_harden_projects_null_owner_rls.sql");

    expect(migration).toContain('CREATE POLICY "Projects visible to owner, org members, shared users, or public demo"');
    expect(migration).toContain('CREATE POLICY "Projects insert for owner in own tenant"');
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_projects_metadata()");
    expect(migration).not.toContain("owner_id IS NULL");
    expect(migration).not.toContain("p.owner_id IS NULL");
  });

  it("vazuje orphan projekty na tenant nebo explicitní share namísto veřejného přístupu", () => {
    const migration = readMigration("20260320180000_harden_projects_null_owner_rls.sql");

    expect(migration).toContain("(organization_id IS NOT NULL AND public.is_org_member(organization_id))");
    expect(migration).toContain("public.is_project_shared_with_user(id, auth.uid())");
    expect(migration).toContain("public.has_project_share_permission(id, auth.uid(), 'edit')");
    expect(migration).toContain("is_demo = true");
  });

  it("sjednocuje share RPC s novou access logikou bez public NULL-owner výjimky", () => {
    const migration = readMigration("20260320180000_harden_projects_null_owner_rls.sql");

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_project_shares(project_id_input TEXT)");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_project_shares_v2(project_id_input TEXT)");
    expect(migration).toContain("p.organization_id IS NOT NULL AND public.is_org_member(p.organization_id)");
    expect(migration).not.toContain("Legacy Public Project");
  });
});
