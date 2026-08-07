import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260807152300_allow_demo_bid_select.sql",
);
const restoredMigrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260721182846_restore_pre_demo_database_access.sql",
);

describe("DocHub demo bid visibility migration", () => {
  it("allows read-only bid visibility for an unhidden demo project", () => {
    const migration = fs.readFileSync(migrationPath, "utf8");

    expect(migration).toContain('CREATE POLICY "Bids visible through project"');
    expect(migration).toContain("FOR SELECT");
    expect(migration).toContain("p.is_demo = true");
    expect(migration).toContain("public.user_hidden_projects");
    expect(migration).not.toContain("FOR INSERT");
    expect(migration).not.toContain("FOR UPDATE");
    expect(migration).not.toContain("FOR DELETE");
  });

  it("supports both historical bid category column names", () => {
    for (const pathToMigration of [restoredMigrationPath, migrationPath]) {
      const migration = fs.readFileSync(pathToMigration, "utf8");
      expect(migration).toContain("bid_category_column");
      expect(migration).toContain("column_name IN ('demand_category_id', 'category_id')");
      expect(migration).toContain("bids.%1$I::text");
      expect(migration).not.toContain("bids.demand_category_id::text");
    }
  });
});
