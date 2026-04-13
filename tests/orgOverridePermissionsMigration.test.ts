import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const readMigration = (name: string): string =>
  fs.readFileSync(path.join(ROOT, "supabase/migrations", name), "utf8");

describe("org override permission hardening migration", () => {
  const migrationName = "20260412200000_harden_org_override_permissions.sql";

  it("uzamyká přímý zápis do user_feature_overrides jen na service role", () => {
    const migration = readMigration(migrationName);

    expect(migration).toContain('DROP POLICY IF EXISTS "Service role manages feature overrides" ON public.user_feature_overrides;');
    expect(migration).toContain("USING (auth.role() = 'service_role')");
    expect(migration).toContain("WITH CHECK (auth.role() = 'service_role')");
    expect(migration).toContain("REVOKE ALL ON public.user_feature_overrides FROM authenticated;");
    expect(migration).toContain("GRANT SELECT ON public.user_feature_overrides TO authenticated;");
  });

  it("RPC set_org_override povoluje jen service role nebo platform admina", () => {
    const migration = readMigration(migrationName);

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.set_org_override(");
    expect(migration).toContain("IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN");
    expect(migration).toContain("RAISE EXCEPTION 'Only platform admins can set organization overrides';");
  });

  it("RPC grant_user_feature povoluje jen service role nebo platform admina", () => {
    const migration = readMigration(migrationName);

    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.grant_user_feature(");
    expect(migration).toContain("IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN");
    expect(migration).toContain("RAISE EXCEPTION 'Only platform admins can grant user features';");
  });
});
