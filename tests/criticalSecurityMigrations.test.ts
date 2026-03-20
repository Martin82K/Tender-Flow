import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const readMigration = (name: string): string =>
  fs.readFileSync(path.join(ROOT, "supabase/migrations", name), "utf8");

describe("critical security hardening migrations", () => {
  it("neutralizuje historické Baustav migrace pro nové environmenty", () => {
    const legacySeed = readMigration("20251205000300_03_data_migration.sql");
    const massAssign = readMigration("20260117000100_assign_all_contacts_to_baustav.sql");
    const hardcodedOwner = readMigration("20260117000300_add_admin_to_baustav.sql");

    expect(legacySeed).not.toContain("UPDATE public.subcontractors");
    expect(legacySeed).not.toContain("UPDATE public.projects");
    expect(legacySeed).toContain("Skipping legacy mass reassignment");

    expect(massAssign).not.toContain("UPDATE public.subcontractors");
    expect(massAssign).toContain("Legacy cross-tenant contact reassignment disabled");

    expect(hardcodedOwner).not.toContain("INSERT INTO public.organization_members");
    expect(hardcodedOwner).not.toContain("martinkalkus82@gmail.com");
    expect(hardcodedOwner).toContain("hard-coded Baustav owner membership disabled");
  });

  it("přidává dedikovaný zdroj pravdy pro platform adminy", () => {
    const migration = readMigration("20260320150000_harden_platform_admin_and_org_security.sql");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.platform_admins");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.is_platform_admin");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.is_admin()");
    expect(migration).toContain("public.is_platform_admin(auth.uid())");
    expect(migration).not.toContain("v_user_tier = 'admin'");
    expect(migration).toContain("Seeded from legacy admin email allowlist");
  });

  it("odstraňuje admin vazbu ze subscription override a chrání citlivé profilové sloupce", () => {
    const migration = readMigration("20260320150000_harden_platform_admin_and_org_security.sql");

    expect(migration).toContain("WHERE subscription_tier_override = 'admin'");
    expect(migration).toContain("SET subscription_tier_override = 'enterprise'");
    expect(migration).toContain("subscription_tier_override IN ('free', 'starter', 'pro', 'enterprise')");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.guard_user_profiles_sensitive_columns()");
    expect(migration).toContain("Protected profile fields cannot be changed by the profile owner");
    expect(migration).toContain("DROP TRIGGER IF EXISTS guard_user_profiles_sensitive_columns ON public.user_profiles");
  });

  it("odděluje interní organization bootstrap od veřejného RPC wrapperu", () => {
    const migration = readMigration("20260320150000_harden_platform_admin_and_org_security.sql");

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_or_create_user_organization_internal");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_or_create_user_organization(");
    expect(migration).toContain("IF p_user_id IS NOT NULL AND p_user_id <> v_auth_user_id THEN");
    expect(migration).toContain("IF p_email IS NOT NULL AND lower(trim(p_email)) <> lower(trim(v_auth_email)) THEN");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.get_or_create_user_organization_internal(UUID, TEXT, TEXT) FROM authenticated;");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.get_or_create_user_organization(UUID, TEXT, TEXT) TO authenticated;");
  });

  it("ukládá auditní snapshot Baustav incidentu a obnovuje strict subcontractor policies", () => {
    const migration = readMigration("20260320150000_harden_platform_admin_and_org_security.sql");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.security_baustav_subcontractor_audit");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.security_baustav_membership_audit");
    expect(migration).toContain("Captured during 2026-03-20 review of Baustav reassignment incident");
    expect(migration).toContain("Captured during 2026-03-20 review of Baustav owner/admin memberships");
    expect(migration).toContain("CREATE POLICY \"Subcontractors visible to owner or org\"");
    expect(migration).toContain("CREATE POLICY \"Subcontractors insert restricted to owner or org\"");
    expect(migration).toContain("organization_id IS NOT NULL AND organization_id = ANY(public.get_my_org_ids())");
  });
});
