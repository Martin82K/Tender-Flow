import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const expectAdaptiveBidCategoryColumn = (sql: string) => {
  expect(sql).toContain("FROM information_schema.columns");
  expect(sql).toContain("column_name IN ('demand_category_id', 'category_id')");
  expect(sql).toContain("WHEN 'demand_category_id' THEN 0");
  expect(sql).toContain("Bid category column is missing");
  expect(sql).toContain("bids.%1$I::text");
};

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
    expectAdaptiveBidCategoryColumn(sql);
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

  it("restores pre-demo database behavior without breaking tenant-scoped bids", () => {
    const migrationsDir = join(process.cwd(), "supabase", "migrations");
    const migrationName = readdirSync(migrationsDir).find((name) =>
      name.endsWith("_restore_pre_demo_database_access.sql"),
    );

    expect(migrationName).toBeDefined();

    const sql = readFileSync(join(migrationsDir, migrationName!), "utf8");
    const bidPolicies = sql
      .split("CREATE POLICY")
      .slice(1)
      .filter((policy) => /^\s+"[^"]+"\s*\n\s*ON public\.bids/m.test(policy));

    expect(sql).toContain(
      'CREATE POLICY "Projects visible to owner, explicit shares, or public demo"',
    );
    expect(sql).toContain(
      'CREATE POLICY "Demand categories visible through project"',
    );
    expectAdaptiveBidCategoryColumn(sql);
    expect(sql.match(/EXECUTE format\(\$policy\$/g)).toHaveLength(4);
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/WITH CHECK\s*\(\s*true\s*\)/i);
    expect(bidPolicies).toHaveLength(4);
    expect(
      bidPolicies.map(
        (policy) => policy.match(/FOR (SELECT|INSERT|UPDATE|DELETE)/)?.[1],
      ),
    ).toEqual(["SELECT", "INSERT", "UPDATE", "DELETE"]);
    expect(bidPolicies[0]).toContain(
      "public.is_project_shared_with_user(p.id, (SELECT auth.uid()))",
    );
    for (const policy of bidPolicies.slice(1)) {
      expect(policy).toMatch(
        /public\.has_project_share_permission\(\s*p\.id,\s*\(SELECT auth\.uid\(\)\),\s*'edit'\s*\)/,
      );
    }
  });
});
