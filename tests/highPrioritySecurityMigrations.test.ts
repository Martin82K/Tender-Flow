import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const readMigration = (name: string): string =>
  fs.readFileSync(path.join(ROOT, "supabase/migrations", name), "utf8");

describe("high priority security hardening migrations", () => {
  it("join requests důvěřují jen auth identitě a validní doméně organizace", () => {
    const migration = readMigration("20260320170000_harden_org_join_and_subscription_rpc.sql");

    expect(migration).toContain("lower(trim(email)) = lower(trim(COALESCE(auth.jwt() ->> 'email', '')))");
    expect(migration).toContain("email must match authenticated user");
    expect(migration).toContain("SELECT lower(trim(email))");
    expect(migration).toContain("VALUES (target_org, v_user_id, v_auth_email)");
    expect(migration).toContain("status = 'pending'");
  });

  it("trial a activate subscription RPC už nejsou grantnuté authenticated roli", () => {
    const migration = readMigration("20260320170000_harden_org_join_and_subscription_rpc.sql");

    expect(migration).toContain("REVOKE EXECUTE ON FUNCTION public.start_user_trial(UUID, TEXT, INTEGER) FROM authenticated;");
    expect(migration).toContain("REVOKE EXECUTE ON FUNCTION public.activate_subscription(UUID, TEXT, TEXT, INTEGER, TEXT, TEXT) FROM authenticated;");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.start_user_trial(UUID, TEXT, INTEGER) TO service_role;");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.activate_subscription(UUID, TEXT, TEXT, INTEGER, TEXT, TEXT) TO service_role;");
    expect(migration).toContain("IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN");
  });

  it("cancel a reactivate subscription zůstávají self-service bez cizího user_id", () => {
    const migration = readMigration("20260320170000_harden_org_join_and_subscription_rpc.sql");

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.cancel_subscription()");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.reactivate_subscription()");
    expect(migration).toContain("v_user_id := auth.uid();");
    expect(migration).not.toContain("CREATE OR REPLACE FUNCTION public.cancel_subscription(p_user_id UUID");
    expect(migration).not.toContain("CREATE OR REPLACE FUNCTION public.reactivate_subscription(p_user_id UUID");
  });

  it("citlivá smluvní a finanční data už nejsou čitelná přes ownerless projekt fallback", () => {
    const migration = readMigration("20260320173000_harden_ownerless_sensitive_project_data_rls.sql");

    expect(migration).toContain('ALTER TABLE public.project_investor_financials ENABLE ROW LEVEL SECURITY;');
    expect(migration).toContain('ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;');
    expect(migration).toContain('ALTER TABLE public.contract_markdown_versions ENABLE ROW LEVEL SECURITY;');
    expect(migration).not.toContain("owner_id IS NULL");
  });

  it("projects RLS už nedělá z NULL-owner řádků globálně čitelné nebo editovatelné projekty", () => {
    const migration = readMigration("20260320180000_harden_projects_null_owner_rls.sql");

    expect(migration).toContain('CREATE POLICY "Projects visible to owner, org members, shared users, or public demo"');
    expect(migration).toContain('CREATE POLICY "Projects update for owner, org member, or shared editor"');
    expect(migration).toContain("public.is_org_member(organization_id)");
    expect(migration).not.toContain("owner_id IS NULL");
  });

  it("subcontractor RLS už neotevírá kontakty každému členu organizace bez explicitního oprávnění", () => {
    const migration = readMigration("20260320183000_harden_subcontractors_rls.sql");

    expect(migration).toContain('CREATE POLICY "Subcontractors visible to owner or org"');
    expect(migration).toContain("organization_id = ANY(public.get_my_org_ids())");
    expect(migration).not.toContain("owner_id IS NULL");
    expect(migration).toContain('DROP POLICY IF EXISTS "Users can view own or public subcontractors" ON public.subcontractors;');
  });
});
