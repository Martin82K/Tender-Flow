import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const readMigration = (name: string): string =>
  fs.readFileSync(path.join(ROOT, "supabase/migrations", name), "utf8");

describe("project scoped templates backfill migration", () => {
  it("kopíruje původní uživatelské šablony do každé stavby a defaulty používá jen jako fallback", () => {
    const migration = readMigration("20260605133000_backfill_project_scoped_templates.sql");

    expect(migration).toContain("accessible_project_users");
    expect(migration).toContain("legacy.project_id IS NULL");
    expect(migration).toContain("legacy.name");
    expect(migration).toContain("legacy.content");
    expect(migration).toContain("CROSS JOIN public.default_templates defaults");
    expect(migration).toContain("NOT EXISTS");
    expect(migration).toContain("public.project_shares");
  });
});
