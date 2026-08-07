import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260807211127_harden_bids_write_rls.sql",
);

const migration = fs.readFileSync(migrationPath, "utf8");

describe("bids write RLS hardening migration", () => {
  it("replaces every bid write policy without changing read visibility", () => {
    for (const operation of ["insert", "update", "delete"] as const) {
      const policyName = `Bids ${operation} for project editors`;
      expect(migration).toContain(`DROP POLICY IF EXISTS "${policyName}"`);
      expect(migration).toContain(`CREATE POLICY "${policyName}"`);
    }

    expect(migration).not.toContain('DROP POLICY IF EXISTS "Bids visible through project"');
    expect(migration).not.toContain('CREATE POLICY "Bids visible through project"');
    expect(migration).not.toContain("FOR SELECT");
  });

  it("allows writes only to the project owner or an explicit shared editor", () => {
    expect(migration.match(/p\.owner_id = \(SELECT auth\.uid\(\)\)/g)).toHaveLength(4);
    expect(
      migration.match(
        /public\.has_project_share_permission\(p\.id, \(SELECT auth\.uid\(\)\), 'edit'\)/g,
      ),
    ).toHaveLength(4);
    expect(migration).not.toContain("public.is_org_member");
    expect(migration).not.toContain("p.organization_id");
  });

  it("uses WITH CHECK for inserts and both USING and WITH CHECK for updates", () => {
    expect(migration).toMatch(
      /CREATE POLICY "Bids insert for project editors"[\s\S]*?FOR INSERT[\s\S]*?WITH CHECK/,
    );
    expect(migration).toMatch(
      /CREATE POLICY "Bids update for project editors"[\s\S]*?FOR UPDATE[\s\S]*?USING[\s\S]*?WITH CHECK/,
    );
    expect(migration).toMatch(
      /CREATE POLICY "Bids delete for project editors"[\s\S]*?FOR DELETE[\s\S]*?USING/,
    );
  });

  it("supports both historical bid category column names", () => {
    expect(migration).toContain("bid_category_column");
    expect(migration).toContain("column_name IN ('demand_category_id', 'category_id')");
    expect(migration).toContain("bids.%1$I::text");
  });
});
