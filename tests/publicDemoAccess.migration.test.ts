import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("public demo access migration", () => {
  it("removes demo RLS exceptions and anonymous metadata access", () => {
    const migrationsDir = join(process.cwd(), "supabase", "migrations");
    const migrationName = readdirSync(migrationsDir).find((name) =>
      name.endsWith("_disable_public_demo_access.sql"),
    );

    expect(migrationName).toBeDefined();

    const sql = readFileSync(join(migrationsDir, migrationName!), "utf8");

    expect(sql).not.toMatch(/\bis_demo\s*=\s*true\b/i);
    expect(sql).toContain(
      'CREATE POLICY "Projects visible to owner or explicit shares"',
    );
    expect(sql).toContain(
      'CREATE POLICY "Demand categories visible through project"',
    );
    expect(sql).toContain(
      'CREATE POLICY "Bids inherit category->project access"',
    );
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.get_projects_metadata() FROM PUBLIC",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_projects_metadata() TO authenticated",
    );
  });

  it("removes the permissive bids policy that would bypass project access", () => {
    const migrationsDir = join(process.cwd(), "supabase", "migrations");
    const migrationName = readdirSync(migrationsDir).find((name) =>
      name.endsWith("_remove_unrestricted_bids_policy.sql"),
    );

    expect(migrationName).toBeDefined();

    const sql = readFileSync(join(migrationsDir, migrationName!), "utf8");

    expect(sql).toContain(
      'DROP POLICY IF EXISTS "Enable all access for authenticated users"',
    );
    expect(sql).toContain("ON public.bids");
  });
});
